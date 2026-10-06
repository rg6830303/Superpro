import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createRazorpayOrder, isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { attachOrder, getRegistration, setPayVenue } from "@/lib/coaching-registrations";

export const runtime = "nodejs";

const schema = z.object({
  reference: z.string().trim().regex(/^SP-[A-Z0-9]{8}$/),
  venue: z.string().trim().max(30).optional(),
});

/** Pay for a registration later, from its status page (optionally switching the venue paid for). */
export async function POST(req: Request) {
  const rl = await checkRateLimit(`coach-pay:${getClientIp(req)}`, 20, 15 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  if (!isRazorpayEnabled) return NextResponse.json({ error: "Online payment isn't available right now. Please call us." }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

  try {
    let reg = await getRegistration(parsed.data.reference);
    if (!reg) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    if (reg.payment_status === "paid") return NextResponse.json({ error: "This registration is already paid." }, { status: 409 });
    if (reg.status === "cancelled") return NextResponse.json({ error: "This registration was cancelled." }, { status: 409 });
    if (parsed.data.venue && parsed.data.venue !== reg.pay_venue) {
      try {
        reg = await setPayVenue(reg, parsed.data.venue);
      } catch {
        return NextResponse.json({ error: "Pick one of the venues on your registration." }, { status: 400 });
      }
    }
    const o = await createRazorpayOrder({
      amountPaise: reg.amount_paise,
      receipt: reg.reference,
      notes: { kind: "coaching_registration", reference: reg.reference },
    });
    await attachOrder(reg.id, o.id);
    return NextResponse.json({
      ok: true,
      reference: reg.reference,
      order: { id: o.id, amount: o.amount },
      key_id: razorpayKeyId,
      prefill: { name: reg.name, contact: reg.phone, email: reg.email ?? undefined },
    });
  } catch (err) {
    console.error("[coaching/register/pay]", err);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 500 });
  }
}
