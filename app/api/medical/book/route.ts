import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getPlayerSession } from "@/lib/auth";
import { createRazorpayOrder, isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { CONCERNS, SLOTS, attachAppointmentOrder, createAppointment } from "@/lib/doctor";
import { sendAppointmentEmail } from "@/lib/doctor-emails";

export const runtime = "nodejs";

const mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number");

const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: mobile,
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")]).optional(),
  age: z.coerce.number().int().min(3, "Enter a valid age").max(100, "Enter a valid age"),
  gender: z.enum(["Male", "Female", "Other"], { message: "Choose a gender" }),
  concern: z.enum(CONCERNS, { message: "Choose what you need help with" }),
  details: z.string().trim().max(500).optional(),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .refine((d) => d >= todayIst(), "Pick today or a later date")
    .refine((d) => d <= new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), "Pick a date within the next 60 days"),
  preferredSlot: z.enum(SLOTS, { message: "Choose a time" }),
  payNow: z.boolean().default(true),
});

/** Book a clinic consultation; optionally open the Razorpay order straight away. */
export async function POST(req: Request) {
  const rl = await checkRateLimit(`doctor-book:${getClientIp(req)}`, 8, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many bookings. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
  const d = parsed.data;
  try {
    const session = await getPlayerSession();
    const appt = await createAppointment({
      userId: session?.id ?? null,
      name: d.name,
      phone: d.phone,
      email: d.email || null,
      age: d.age,
      gender: d.gender,
      concern: d.concern,
      details: d.details || null,
      preferredDate: d.preferredDate,
      preferredSlot: d.preferredSlot,
    });
    let order: { id: string; amount: number } | null = null;
    if (d.payNow && isRazorpayEnabled) {
      try {
        const o = await createRazorpayOrder({ amountPaise: appt.amount_paise, receipt: appt.reference, notes: { kind: "doctor_appointment", reference: appt.reference } });
        await attachAppointmentOrder(appt.id, o.id);
        order = { id: o.id, amount: o.amount };
      } catch (err) {
        console.error("[medical/book] order failed:", err instanceof Error ? err.message : err);
      }
    }
    await sendAppointmentEmail(appt, new URL(req.url).origin, "booked");
    return NextResponse.json({
      ok: true,
      reference: appt.reference,
      order,
      key_id: order ? razorpayKeyId : null,
      prefill: { name: appt.name, contact: appt.phone, email: appt.email ?? undefined },
    });
  } catch (err) {
    console.error("[medical/book]", err);
    return NextResponse.json({ error: "Could not save your booking. Please try again." }, { status: 500 });
  }
}
