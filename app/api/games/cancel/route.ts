import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { adjustWallet } from "@/lib/wallet";
import { promoteWaitlist } from "@/lib/slot-rules";

export const runtime = "nodejs";

const schema = z.object({ registration_id: z.string().uuid() });

/**
 * A player backs out of a slot (or leaves its waitlist) before it starts.
 * Anything they paid for it goes back to their Sparvic wallet, and the seat is
 * offered to the waitlist straight away.
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
      id: string; session_id: string; status: string; payment_status: string; payment_method: string;
      amount_paise: number; started: boolean; reference: string | null;
    }>(
      `SELECT r.id, r.session_id, r.status, r.payment_status, r.payment_method, r.amount_paise, r.reference,
              ((s.session_date + s.start_time::time) AT TIME ZONE 'Asia/Kolkata') <= now() AS started
       FROM game_registrations r JOIN game_sessions s ON s.id = r.session_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [parsed.data.registration_id, session.id],
    );
    if (!reg) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (!["confirmed", "pending_approval", "waitlist"].includes(reg.status)) {
      return NextResponse.json({ error: "This booking is already cancelled." }, { status: 409 });
    }
    if (reg.started) return NextResponse.json({ error: "This slot has already started, so it can't be cancelled here. Message the club." }, { status: 409 });

    const refund = reg.payment_status === "paid" ? Number(reg.amount_paise) : 0;
    const done = await queryOne<{ id: string }>(
      `UPDATE game_registrations SET status = 'cancelled', payment_status = CASE WHEN $2 > 0 THEN 'refunded' ELSE payment_status END
       WHERE id = $1 AND status IN ('confirmed','pending_approval','waitlist') RETURNING id`,
      [reg.id, refund],
    );
    if (!done) return NextResponse.json({ error: "This booking is already cancelled." }, { status: 409 });
    if (refund > 0) {
      await adjustWallet({
        userId: session.id,
        deltaPaise: refund,
        kind: "refund",
        reason: `Left a daily-games slot${reg.reference ? ` (${reg.reference})` : ""}`,
        refTable: "game_registrations",
        refId: reg.id,
      });
    }
    const wasSeat = reg.status !== "waitlist";
    if (wasSeat) await promoteWaitlist(reg.session_id).catch(() => 0);
    return NextResponse.json({
      ok: true,
      refunded_paise: refund,
      message: refund > 0 ? `Cancelled. ₹${(refund / 100).toLocaleString("en-IN")} is back in your Sparvic wallet.` : wasSeat ? "Cancelled — your spot has been offered to the waitlist." : "You've left the waitlist.",
    });
  } catch (err) {
    console.error("[games/cancel]", err);
    return NextResponse.json({ error: "Could not cancel. Please try again." }, { status: 500 });
  }
}
