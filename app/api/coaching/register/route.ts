import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getPlayerSession } from "@/lib/auth";
import { createRazorpayOrder, isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { attachOrder, createRegistration } from "@/lib/coaching-registrations";
import { sendRegistrationEmail } from "@/lib/coaching-emails";
import { DAYS, GENDERS, MIN_DAYS, MIN_TIMINGS, SKILLS, TIMINGS, VENUES, feeFor } from "@/lib/coaching-program";

export const runtime = "nodejs";

/** Accepts "98765 43210", "+91 98765 43210", "09876543210". */
const mobile = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
    .refine((v) => /^[6-9]\d{9}$/.test(v), `Enter a valid 10-digit mobile number for ${label}`);

const venueIds = VENUES.map((v) => v.id) as [string, ...string[]];

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(80),
    gender: z.enum(GENDERS, { message: "Choose a gender" }),
    phone: mobile("your contact"),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")]).optional(),
    age: z.coerce.number().int().min(4, "Enter a valid age").max(90, "Enter a valid age"),
    skill: z.enum(SKILLS.map((s) => s.id) as [string, ...string[]], { message: "Choose your skill level" }),
    days: z.array(z.enum(DAYS)).min(MIN_DAYS, `Pick at least ${MIN_DAYS} days`),
    venues: z.array(z.enum(venueIds)).min(1, "Pick at least one venue"),
    timings: z.array(z.enum(TIMINGS)).min(MIN_TIMINGS, `Pick at least ${MIN_TIMINGS} timings`),
    emergencyPhone: mobile("the emergency contact"),
    emergencyRelation: z.string().trim().min(2, "Tell us how the emergency contact is related to you").max(40),
    medical: z.string().trim().max(300).optional(),
    payVenue: z.enum(venueIds),
    payNow: z.boolean().default(true),
  })
  .refine((d) => d.venues.includes(d.payVenue), { message: "Pay for one of the venues you picked", path: ["payVenue"] })
  .refine((d) => feeFor(d.payVenue, d.age) != null, {
    message: "This venue is for adults only — pick another venue for under-16s",
    path: ["payVenue"],
  })
  .refine((d) => d.phone !== d.emergencyPhone, {
    message: "The emergency contact should be someone else's number",
    path: ["emergencyPhone"],
  });

/** Register for the monthly group batch; optionally open a Razorpay order straight away. */
export async function POST(req: Request) {
  const rl = await checkRateLimit(`coach-reg:${getClientIp(req)}`, 8, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many registrations. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Check the form.", field: issue?.path?.[0] }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const session = await getPlayerSession();
    const reg = await createRegistration({
      name: d.name,
      gender: d.gender,
      phone: d.phone,
      email: d.email || null,
      age: d.age,
      skill: d.skill,
      days: d.days,
      venues: d.venues,
      timings: d.timings,
      emergencyPhone: d.emergencyPhone,
      emergencyRelation: d.emergencyRelation,
      medical: d.medical || null,
      payVenue: d.payVenue,
      userId: session?.id ?? null,
    });

    const origin = new URL(req.url).origin;
    let order: { id: string; amount: number } | null = null;
    if (d.payNow && isRazorpayEnabled) {
      try {
        const o = await createRazorpayOrder({
          amountPaise: reg.amount_paise,
          receipt: reg.reference,
          notes: { kind: "coaching_registration", reference: reg.reference },
        });
        await attachOrder(reg.id, o.id);
        order = { id: o.id, amount: o.amount };
      } catch (err) {
        // The registration is safe; they can pay from the status page.
        console.error("[coaching/register] order failed:", err instanceof Error ? err.message : err);
      }
    }
    await sendRegistrationEmail(reg, origin, "registered");

    return NextResponse.json({
      ok: true,
      reference: reg.reference,
      amount_paise: reg.amount_paise,
      order,
      key_id: order ? razorpayKeyId : null,
      prefill: { name: reg.name, contact: reg.phone, email: reg.email ?? undefined },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "fee_unavailable") {
      return NextResponse.json({ error: "That venue isn't available for this age group." }, { status: 400 });
    }
    console.error("[coaching/register]", err);
    return NextResponse.json({ error: "Could not save your registration. Please try again." }, { status: 500 });
  }
}
