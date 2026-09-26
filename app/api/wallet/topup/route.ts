import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { newRef } from "@/lib/money";
import { createRazorpayOrder, isRazorpayEnabled } from "@/lib/razorpay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  amount_rupees: z.number().int().min(100, "Minimum top-up is ₹100").max(50000, "Maximum top-up is ₹50,000"),
});

/**
 * Player-initiated wallet top-up.
 *
 * This only creates the Razorpay order. The wallet is credited in
 * /api/payments/verify once the signature checks out — crediting here would
 * hand anyone who can call this endpoint free balance.
 */
export async function POST(req: Request) {
  try {
    const session = await getPlayerSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in to top up your wallet." }, { status: 401 });
    }

    const rl = await checkRateLimit(`topup:${getClientIp(req)}`, 10, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid amount." }, { status: 400 });
    }

    if (!isRazorpayEnabled) {
      return NextResponse.json(
        { error: "Online top-ups are not switched on yet. Any Sparvic rep can load your wallet at the venue." },
        { status: 503 },
      );
    }

    await ensureSchema();

    const amountPaise = parsed.data.amount_rupees * 100;
    const reference = newRef("SPW");

    const rzp = await createRazorpayOrder({
      amountPaise,
      receipt: reference,
      notes: { kind: "wallet_topup", user_id: session.id, reference },
    });

    // Parked as a queued ledger row so a payment that succeeds at the gateway
    // but never reaches us is still visible and reconcilable.
    await query(
      `INSERT INTO wallet_topups (reference, user_id, amount_paise, razorpay_order_id, status)
       VALUES ($1,$2,$3,$4,'pending')`,
      [reference, session.id, amountPaise, rzp.id],
    );

    return NextResponse.json({
      ok: true,
      reference,
      amount_paise: amountPaise,
      razorpay_order_id: rzp.id,
    });
  } catch (err) {
    console.error("[wallet/topup]", err);
    return NextResponse.json({ error: "Could not start the top-up. Please try again." }, { status: 500 });
  }
}
