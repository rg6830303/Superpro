import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { createRazorpayOrder, isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { OPEN } from "@/lib/sparvic-open";
import { afterEntryPaid, type OpenEntry } from "@/lib/sparvic-open-server";
import { debitForTournament, refundTournament } from "@/lib/sparvic-open-wallet";

export const runtime = "nodejs";

const schema = z.object({ reference: z.string().regex(/^SO-[A-F0-9]{8}$/), pay_method: z.enum(["online", "wallet"]).default("online") });
const inr = (x: number) => `₹${(Number(x) / 100).toLocaleString("en-IN")}`;

/** Pay for an unpaid entry later, from the entries list. */
export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  try {
    await ensureSchema();
    const e = await queryOne<OpenEntry>(`SELECT * FROM open_entries WHERE reference = $1 AND user_id = $2`, [parsed.data.reference, session.id]);
    if (!e) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    if (e.payment_status !== "pending") return NextResponse.json({ error: e.payment_status === "paid" ? "This entry is already paid." : "This entry was cancelled." }, { status: 409 });
    if (parsed.data.pay_method === "wallet") {
      const debit = await debitForTournament(session.id, e.amount_paise, e.reference);
      if (!debit.ok) return NextResponse.json({ error: `Your wallet has ${inr(debit.balancePaise)}, the entry is ${inr(e.amount_paise)}. Top up or pay online.`, code: "wallet_insufficient" }, { status: 402 });
      const done = await queryOne<OpenEntry>(
        `UPDATE open_entries SET payment_status = 'paid', razorpay_payment_id = 'wallet', paid_at = now() WHERE id = $1 AND payment_status = 'pending' RETURNING *`,
        [e.id],
      );
      if (!done) { await refundTournament(session.id, e.amount_paise, e.reference); return NextResponse.json({ error: "This entry changed. Your wallet was not charged." }, { status: 409 }); }
      await afterEntryPaid(done);
      return NextResponse.json({ ok: true, reference: e.reference, paid_via: "wallet", balance_paise: debit.balancePaise });
    }
    if (!isRazorpayEnabled) return NextResponse.json({ error: "Online payment isn't available right now. Pay from your Sparvic Wallet." }, { status: 503 });
    const order = await createRazorpayOrder({ amountPaise: e.amount_paise, receipt: e.reference, notes: { kind: "sparvic_open", reference: e.reference } });
    await query(`UPDATE open_entries SET razorpay_order_id = $2 WHERE id = $1`, [e.id, order.id]);
    return NextResponse.json({
      ok: true,
      reference: e.reference,
      order: { id: order.id, amount: order.amount },
      key_id: razorpayKeyId,
      prefill: { name: e.player_name, contact: e.player_phone ?? undefined, email: e.player_email ?? undefined },
      description: `${OPEN.name} · ${e.reference}${Number((e as { discount_paise?: number }).discount_paise ?? 0) > 0 ? ` · Early bird ${OPEN.earlyBirdPct}% off applied` : ""}`,
    });
  } catch (err) {
    console.error("[sparvic-open/pay]", err);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 500 });
  }
}
