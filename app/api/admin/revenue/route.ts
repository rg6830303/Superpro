import { NextResponse } from "next/server";
import { adminGate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Revenue and bookings, across every paid surface.
 *
 * One accounting point decides the shape of this: a wallet top-up is NOT
 * revenue. It is cash received against a liability — the club owes that credit
 * back as court time or gear. The revenue is earned later, when the player
 * spends it. Counting both the top-up and the booking it pays for would
 * overstate takings, so top-ups are reported separately as cash-in and float
 * held, and never added to the earned figure.
 */

const WINDOWS: Record<string, string> = {
  today: "created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')",
  week: "created_at >= now() - interval '7 days'",
  month: "created_at >= now() - interval '30 days'",
  all: "true",
};

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const windowKey = new URL(req.url).searchParams.get("window") ?? "month";
    const where = WINDOWS[windowKey] ?? WINDOWS.month;

    // Each source reports the same shape so the UI can treat them uniformly:
    // what was earned, what is still owed, and how many transactions.
    const source = (table: string, amount: string, label: string) => `
      SELECT '${label}' AS source,
             COALESCE(SUM(${amount}) FILTER (WHERE payment_status = 'paid'), 0)::bigint    AS earned_paise,
             COALESCE(SUM(${amount}) FILTER (WHERE payment_status = 'pending'), 0)::bigint AS owed_paise,
             COALESCE(SUM(discount_paise), 0)::bigint                                      AS discount_paise,
             COUNT(*) FILTER (WHERE payment_status = 'paid')::int                          AS paid_count,
             COUNT(*) FILTER (WHERE payment_status = 'pending')::int                       AS pending_count
      FROM ${table} WHERE ${where}`;

    const bySource = await query(
      `${source("orders", "total_paise", "Shop")}
       UNION ALL ${source("game_registrations", "amount_paise", "Daily games")}
       UNION ALL ${source("coaching_bookings", "amount_paise", "Coaching")}
       UNION ALL ${source("tournament_registrations", "amount_paise", "Tournaments")}`,
    ).catch(() => []);

    // How the money actually arrived. Wallet-paid bookings are earnings whose
    // cash landed earlier, at top-up, so the split is worth seeing.
    const methods = await query(
      `SELECT payment_method, COALESCE(SUM(amount_paise), 0)::bigint AS paise, COUNT(*)::int AS n
       FROM (
         SELECT payment_method, total_paise AS amount_paise, payment_status, created_at FROM orders
         UNION ALL SELECT payment_method, amount_paise, payment_status, created_at FROM game_registrations
         UNION ALL SELECT payment_method, amount_paise, payment_status, created_at FROM coaching_bookings
         UNION ALL SELECT payment_method, amount_paise, payment_status, created_at FROM tournament_registrations
       ) t
       WHERE payment_status = 'paid' AND ${where}
       GROUP BY payment_method ORDER BY paise DESC`,
    ).catch(() => []);

    const wallet = await query<{
      topped_up_paise: string; topup_count: number; float_paise: string; pending_count: number;
    }>(
      `SELECT
         COALESCE((SELECT SUM(amount_paise) FROM wallet_topups WHERE status = 'paid' AND ${where}), 0)::bigint
           AS topped_up_paise,
         (SELECT COUNT(*) FROM wallet_topups WHERE status = 'paid' AND ${where})::int AS topup_count,
         COALESCE((SELECT SUM(wallet_balance_paise) FROM users), 0)::bigint AS float_paise,
         (SELECT COUNT(*) FROM wallet_topups WHERE status = 'pending')::int AS pending_count`,
    ).catch(() => []);

    // Daily totals split by source, zero-filled so a quiet day reads as zero
    // rather than closing the gap and flattering the shape. Split, because a
    // single line cannot answer whether the shop or the court earned it.
    const series = await query(
      `SELECT d::date::text AS day,
              COALESCE(SUM(t.amount_paise) FILTER (WHERE t.src = 'shop'), 0)::bigint     AS shop_paise,
              COALESCE(SUM(t.amount_paise) FILTER (WHERE t.src = 'games'), 0)::bigint    AS games_paise,
              COALESCE(SUM(t.amount_paise) FILTER (WHERE t.src = 'other'), 0)::bigint    AS other_paise,
              COALESCE(SUM(t.amount_paise), 0)::bigint                                   AS paise,
              COUNT(t.amount_paise)::int                                                 AS orders
       FROM generate_series(now() - interval '29 days', now(), interval '1 day') d
       LEFT JOIN (
         SELECT 'shop'  AS src, total_paise  AS amount_paise, created_at FROM orders                 WHERE payment_status = 'paid'
         UNION ALL SELECT 'games', amount_paise, created_at FROM game_registrations                  WHERE payment_status = 'paid'
         UNION ALL SELECT 'other', amount_paise, created_at FROM coaching_bookings                   WHERE payment_status = 'paid'
         UNION ALL SELECT 'other', amount_paise, created_at FROM tournament_registrations            WHERE payment_status = 'paid'
       ) t ON t.created_at::date = d::date
       GROUP BY d ORDER BY d`,
    ).catch(() => []);

    // One stream of everything bought, newest first.
    const recent = await query(
      `SELECT * FROM (
         SELECT 'Shop' AS source, order_no AS reference, customer_name AS who, total_paise AS amount_paise,
                payment_status, payment_method, discount_code, created_at::text AS created_at FROM orders
         UNION ALL
         SELECT 'Daily games', reference, player_name, amount_paise, payment_status, payment_method,
                discount_code, created_at::text FROM game_registrations
         UNION ALL
         SELECT 'Coaching', booking_no, player_name, amount_paise, payment_status, payment_method,
                discount_code, created_at::text FROM coaching_bookings
         UNION ALL
         SELECT 'Tournaments', reference, team_name, amount_paise, payment_status, payment_method,
                discount_code, created_at::text FROM tournament_registrations
       ) t ORDER BY created_at DESC LIMIT 40`,
    ).catch(() => []);

    // The operational half of the question: what is on the books right now.
    const bookings = await query<{
      games_confirmed: number; games_pending: number; games_today: number;
      coaching_open: number; tournament_teams: number; orders_open: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM game_registrations WHERE status = 'confirmed')::int        AS games_confirmed,
         (SELECT COUNT(*) FROM game_registrations WHERE status = 'pending_approval')::int AS games_pending,
         (SELECT COUNT(*) FROM game_registrations r JOIN game_sessions s ON s.id = r.session_id
           WHERE s.session_date = (now() AT TIME ZONE 'Asia/Kolkata')::date
             AND r.status = 'confirmed')::int                                             AS games_today,
         (SELECT COUNT(*) FROM coaching_bookings WHERE status IN ('requested','confirmed'))::int AS coaching_open,
         (SELECT COUNT(*) FROM tournament_registrations WHERE status <> 'withdrawn')::int AS tournament_teams,
         (SELECT COUNT(*) FROM orders WHERE fulfillment_status <> 'delivered')::int       AS orders_open`,
    ).catch(() => []);

    // Convenience fee, reported on its own: it is money the club collected but
    // it is a handling charge, not the price of anything, and mixing it into
    // product revenue would overstate what the shop earns.
    const [fees] = await query<{ fee_paise: string; aov_paise: string; paid_orders: number }>(
      `SELECT COALESCE(SUM(convenience_fee_paise) FILTER (WHERE payment_status = 'paid'), 0)::bigint AS fee_paise,
              COALESCE(AVG(total_paise) FILTER (WHERE payment_status = 'paid'), 0)::bigint           AS aov_paise,
              COUNT(*) FILTER (WHERE payment_status = 'paid')::int                                    AS paid_orders
       FROM orders WHERE ${where}`,
    ).catch(() => [{ fee_paise: "0", aov_paise: "0", paid_orders: 0 }]);

    const rows = bySource as Array<{ earned_paise: string; owed_paise: string; discount_paise: string }>;
    const sum = (key: "earned_paise" | "owed_paise" | "discount_paise") =>
      rows.reduce((total, r) => total + Number(r[key] ?? 0), 0);

    return NextResponse.json({
      window: windowKey,
      totals: { earned_paise: sum("earned_paise"), owed_paise: sum("owed_paise"), discount_paise: sum("discount_paise") },
      by_source: bySource,
      fees: fees ?? { fee_paise: "0", aov_paise: "0", paid_orders: 0 },
      by_method: methods,
      wallet: wallet[0] ?? null,
      series,
      recent,
      bookings: bookings[0] ?? null,
    });
  } catch (err) {
    return serverError("revenue", err);
  }
}
