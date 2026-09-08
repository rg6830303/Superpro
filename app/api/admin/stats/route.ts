import { NextResponse } from "next/server";
import { adminGate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { istToday } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Headline numbers for the admin dashboard. One round trip per metric group. */
export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const today = istToday();

    const [revenue, todaySlots, pipeline, outbox] = await Promise.all([
      query<{ orders_paise: number; games_paise: number; coaching_paise: number }>(
        `SELECT
           COALESCE((SELECT SUM(total_paise) FROM orders WHERE payment_status = 'paid'), 0)::int AS orders_paise,
           COALESCE((SELECT SUM(amount_paise) FROM game_registrations WHERE payment_status = 'paid'), 0)::int AS games_paise,
           COALESCE((SELECT SUM(amount_paise) FROM coaching_bookings WHERE payment_status = 'paid'), 0)::int AS coaching_paise`,
      ),
      query<{ slots: number; players: number }>(
        `SELECT
           (SELECT COUNT(*) FROM game_sessions WHERE session_date = $1 AND status = 'open')::int AS slots,
           COALESCE((SELECT SUM(r.players_count) FROM game_registrations r
                     JOIN game_sessions s ON s.id = r.session_id
                     WHERE s.session_date = $1 AND r.status = 'confirmed'), 0)::int AS players`,
        [today],
      ),
      query<{ new_orders: number; coaching_requests: number; tournament_pending: number; players: number }>(
        `SELECT
           (SELECT COUNT(*) FROM orders WHERE fulfillment_status = 'new')::int AS new_orders,
           (SELECT COUNT(*) FROM coaching_bookings WHERE status = 'requested')::int AS coaching_requests,
           (SELECT COUNT(*) FROM tournament_registrations WHERE status = 'pending')::int AS tournament_pending,
           (SELECT COUNT(*) FROM users)::int AS players`,
      ),
      query<{ queued: number; failed: number }>(
        `SELECT
           (SELECT COUNT(*) FROM whatsapp_outbox WHERE status = 'queued')::int AS queued,
           (SELECT COUNT(*) FROM whatsapp_outbox WHERE status = 'failed')::int AS failed`,
      ),
    ]);

    return NextResponse.json({
      revenue: revenue[0],
      today: todaySlots[0],
      pipeline: pipeline[0],
      outbox: outbox[0],
    });
  } catch (err) {
    return serverError("stats", err);
  }
}
