import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { adjustWallet } from "@/lib/wallet";
import { CANCEL_CUTOFF_HOURS, CANCEL_FEE_PAISE, promoteWaitlist, waitlistCanFill } from "@/lib/slot-rules";

export const runtime = "nodejs";

const schema = z.object({ registration_id: z.string().uuid() });

const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

/**
 * A player leaves a slot.
 *
 *   - Waitlist: free, any time before the slot starts (nothing was paid).
 *   - Seat: a ₹75 cancellation charge per slot. A paid seat is refunded to the
 *     wallet minus the charge; an unpaid (pay-at-venue) seat has the charge
 *     taken from the wallet. Inside 4 hours of the start, a seat can only be
 *     given up if someone on the waitlist can take it.
 *
 * The freed seat is offered to the waitlist straight away.
 */
export async function POST(req: Request) {
  const rl = await checkRateLimit(`game-cancel:${getClientIp(req)}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  try {
    await ensureSchema();
    const reg = await queryOne<{
      id: string; session_id: string; status: string; payment_status: string; amount_paise: number;
      reference: string | null; hours_to_start: number;
    }>(
      `SELECT r.id, r.session_id, r.status, r.payment_status, r.amount_paise, r.reference,
              EXTRACT(EPOCH FROM (((s.session_date + s.start_time::time) AT TIME ZONE 'Asia/Kolkata') - now())) / 3600 AS hours_to_start
       FROM game_registrations r JOIN game_sessions s ON s.id = r.session_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [parsed.data.registration_id, session.id],
    );
    if (!reg) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (!["confirmed", "pending_approval", "waitlist"].includes(reg.status)) {
      return NextResponse.json({ error: "This booking is already cancelled." }, { status: 409 });
    }
    const hours = Number(reg.hours_to_start);
    if (hours <= 0) return NextResponse.json({ error: "This slot has already started, so it can't be cancelled." }, { status: 409 });

    // ── Waitlist: free exit ───────────────────────────────────────────────
    if (reg.status === "waitlist") {
      const done = await queryOne<{ id: string }>(
        `UPDATE game_registrations SET status = 'cancelled' WHERE id = $1 AND status = 'waitlist' RETURNING id`,
        [reg.id],
      );
      if (!done) return NextResponse.json({ error: "This booking has already changed. Refresh and try again." }, { status: 409 });
      return NextResponse.json({ ok: true, fee_paise: 0, refunded_paise: 0, message: "You've left the waitlist. No charge." });
    }

    // ── Seat: cut-off, then ₹75 charge ────────────────────────────────────
    if (hours < CANCEL_CUTOFF_HOURS && !(await waitlistCanFill(reg.session_id, reg.id))) {
      return NextResponse.json(
        {
          error: `Slots can't be cancelled within ${CANCEL_CUTOFF_HOURS} hours of the start unless someone on the waitlist can take your place — and nobody can right now.`,
          code: "cutoff",
        },
        { status: 409 },
      );
    }

    const paid = reg.payment_status === "paid" ? Number(reg.amount_paise) : 0;
    const fee = CANCEL_FEE_PAISE;
    const refund = Math.max(0, paid - fee);
    const owed = paid >= fee ? 0 : fee - paid; // unpaid seat (or one cheaper than the fee)

    if (owed > 0) {
      const charge = await adjustWallet({
        userId: session.id,
        deltaPaise: -owed,
        kind: "adjustment",
        reason: `Cancellation charge${reg.reference ? ` (${reg.reference})` : ""}`,
        refTable: "game_registrations",
        refId: reg.id,
      });
      if (!charge.ok) {
        return NextResponse.json(
          { error: `The ${rupees(fee)} cancellation charge couldn't be taken from your wallet (it's at its limit). Top up first, then cancel.` },
          { status: 402 },
        );
      }
    }

    const done = await queryOne<{ id: string }>(
      `UPDATE game_registrations
       SET status = 'cancelled', payment_status = CASE WHEN $2 > 0 THEN 'refunded' ELSE payment_status END
       WHERE id = $1 AND status IN ('confirmed','pending_approval') RETURNING id`,
      [reg.id, paid],
    );
    if (!done) {
      if (owed > 0) await adjustWallet({ userId: session.id, deltaPaise: owed, kind: "refund", reason: "Cancellation did not complete", refTable: "game_registrations", refId: reg.id }).catch(() => {});
      return NextResponse.json({ error: "This booking has already changed. Refresh and try again." }, { status: 409 });
    }
    if (refund > 0) {
      await adjustWallet({
        userId: session.id,
        deltaPaise: refund,
        kind: "refund",
        reason: `Slot cancelled — ${rupees(paid)} less ${rupees(fee)} charge${reg.reference ? ` (${reg.reference})` : ""}`,
        refTable: "game_registrations",
        refId: reg.id,
      });
    }

    const promoted = await promoteWaitlist(reg.session_id).catch(() => 0);
    const money =
      refund > 0
        ? `${rupees(refund)} is back in your wallet (${rupees(paid)} less the ${rupees(fee)} cancellation charge).`
        : owed > 0
          ? `A ${rupees(owed)} cancellation charge was taken from your wallet.`
          : `The ${rupees(fee)} cancellation charge was kept from your payment.`;
    return NextResponse.json({
      ok: true,
      fee_paise: fee,
      refunded_paise: refund,
      message: `Cancelled. ${money}${promoted ? " Your spot went to the next player on the waitlist." : ""}`,
    });
  } catch (err) {
    console.error("[games/cancel]", err);
    return NextResponse.json({ error: "Could not cancel. Please try again." }, { status: 500 });
  }
}
