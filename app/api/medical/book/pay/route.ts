import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createRazorpayOrder, isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { attachAppointmentOrder, getAppointment } from "@/lib/doctor";

export const runtime = "nodejs";

const schema = z.object({ reference: z.string().trim().regex(/^DR-[A-Z0-9]{8}$/) });

/** Pay for a consultation later, from its status page. */
export async function POST(req: Request) {
  const rl = await checkRateLimit(`doctor-pay:${getClientIp(req)}`, 20, 15 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  if (!isRazorpayEnabled) return NextResponse.json({ error: "Online payment isn't available right now. Please call us." }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  try {
    const a = await getAppointment(parsed.data.reference);
    if (!a) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    if (a.payment_status === "paid") return NextResponse.json({ error: "This consultation is already paid." }, { status: 409 });
    if (a.status === "cancelled") return NextResponse.json({ error: "This appointment was cancelled." }, { status: 409 });
    const o = await createRazorpayOrder({ amountPaise: a.amount_paise, receipt: a.reference, notes: { kind: "doctor_appointment", reference: a.reference } });
    await attachAppointmentOrder(a.id, o.id);
    return NextResponse.json({
      ok: true,
      reference: a.reference,
      order: { id: o.id, amount: o.amount },
      key_id: razorpayKeyId,
      prefill: { name: a.name, contact: a.phone, email: a.email ?? undefined },
    });
  } catch (err) {
    console.error("[medical/book/pay]", err);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 500 });
  }
}
