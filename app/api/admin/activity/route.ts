import { NextResponse } from "next/server";
import { adminGate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything that happens on the platform, newest first, in one feed.
 *
 * Each source contributes rows of the same shape — when, what kind, who, what
 * happened, and where in the console to look — so the page can show one list
 * and filter it. Each branch is capped before the merge, so one busy source
 * (say, a burst of bookings) cannot push everything else off the page.
 */

type Kind =
  | "account"
  | "booking"
  | "order"
  | "coaching"
  | "tournament"
  | "follow"
  | "wallet"
  | "admin";

const SOURCES: Record<Kind, string> = {
  account: `
    SELECT e.created_at AS at, 'account' AS kind,
           CASE e.kind WHEN 'signup' THEN 'Signed up' WHEN 'login' THEN 'Signed in'
                       WHEN 'login_failed' THEN 'Failed sign-in' ELSE 'Signed out' END
             || CASE e.actor_type WHEN 'coach' THEN ' (coach)' ELSE '' END AS action,
           COALESCE(e.name, e.email) AS who, e.email AS detail,
           CASE WHEN e.kind = 'login_failed' THEN 'warn' ELSE 'info' END AS tone,
           CASE e.actor_type WHEN 'coach' THEN '/admin/coaching' ELSE '/admin/players' END AS href,
           e.ip AS extra
    FROM account_events e`,
  booking: `
    SELECT r.created_at, 'booking', 'Booked a game', r.player_name,
           r.reference || ' · ' || v.name || ' · ' || to_char(s.session_date, 'DD Mon') || ' ' || s.start_time
             || CASE WHEN r.status = 'pending_approval' THEN ' · awaiting approval' ELSE '' END,
           CASE WHEN r.status = 'cancelled' THEN 'warn' ELSE 'info' END, '/admin/games', r.payment_status
    FROM game_registrations r JOIN game_sessions s ON s.id = r.session_id JOIN venues v ON v.id = s.venue_id`,
  order: `
    SELECT o.created_at, 'order', 'Placed a gear order', o.customer_name,
           o.order_no || ' · ₹' || to_char(o.total_paise / 100.0, 'FM999,99,990') || ' · ' || o.fulfillment_status,
           'info', '/admin/orders', o.payment_status
    FROM orders o`,
  coaching: `
    SELECT b.created_at, 'coaching', 'Requested coaching', b.player_name,
           b.booking_no || ' · ' || c.name || COALESCE(' · ' || to_char(b.preferred_date, 'DD Mon'), ''),
           'info', '/admin/coaching', b.status
    FROM coaching_bookings b JOIN coaches c ON c.id = b.coach_id`,
  tournament: `
    SELECT r.created_at, 'tournament', 'Entered a tournament', r.team_name,
           r.reference || ' · ' || t.title, 'info', '/admin/tournaments', r.status
    FROM tournament_registrations r JOIN tournaments t ON t.id = r.tournament_id`,
  follow: `
    SELECT f.created_at, 'follow', 'Followed a player', a.full_name, 'now follows ' || b.full_name,
           'info', '/admin/players', NULL
    FROM follows f JOIN users a ON a.id = f.follower_id JOIN users b ON b.id = f.following_id`,
  wallet: `
    SELECT w.created_at, 'wallet',
           CASE WHEN w.delta_paise >= 0 THEN 'Wallet credit' ELSE 'Wallet debit' END, u.full_name,
           '₹' || to_char(abs(w.delta_paise) / 100.0, 'FM999,99,990') || ' · ' || COALESCE(w.reason, w.kind)
             || ' · balance ₹' || to_char(w.balance_after_paise / 100.0, 'FM999,99,990'),
           CASE WHEN w.balance_after_paise < 0 THEN 'warn' ELSE 'info' END, '/admin/players', w.created_by
    FROM wallet_transactions w JOIN users u ON u.id = w.user_id`,
  admin: `
    SELECT l.created_at, 'admin', 'Admin: ' || replace(l.action, '.', ' '), l.admin_email,
           COALESCE(l.entity, '') || COALESCE(' ' || left(l.entity_id, 8), ''),
           CASE WHEN l.action LIKE '%delete%' THEN 'warn' ELSE 'info' END, NULL, NULL
    FROM audit_log l`,
};

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const kindParam = url.searchParams.get("kind") ?? "all";
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30) || 30, 1), 365);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 150) || 150, 400);

    const kinds = (kindParam === "all" ? Object.keys(SOURCES) : [kindParam]).filter(
      (k): k is Kind => k in SOURCES,
    );
    if (kinds.length === 0) return NextResponse.json({ events: [], counts: {} });

    // Each branch: its own window and cap, then one merged, ordered list.
    const branches = kinds.map(
      (k) => `(SELECT * FROM (${SOURCES[k]}) src(at, kind, action, who, detail, tone, href, extra)
               WHERE src.at >= now() - ($1 || ' days')::interval
               ORDER BY src.at DESC LIMIT $2)`,
    );
    const events = await query<{
      at: string; kind: Kind; action: string; who: string | null; detail: string | null;
      tone: "info" | "warn"; href: string | null; extra: string | null;
    }>(
      `SELECT at::text AS at, kind, action, who, detail, tone, href, extra FROM (
         ${branches.join(" UNION ALL ")}
       ) feed
       WHERE ($3 = '' OR who ILIKE '%' || $3 || '%' OR detail ILIKE '%' || $3 || '%' OR action ILIKE '%' || $3 || '%')
       ORDER BY at DESC
       LIMIT $2`,
      [String(days), limit, q],
    );

    // Headline numbers for the same window, so the page can say "busy" or "quiet".
    const [counts] = await query<Record<string, number>>(
      `SELECT
         (SELECT COUNT(*) FROM account_events WHERE kind = 'signup' AND created_at >= now() - ($1 || ' days')::interval)::int AS signups,
         (SELECT COUNT(DISTINCT COALESCE(actor_id::text, email)) FROM account_events
            WHERE kind = 'login' AND created_at >= now() - ($1 || ' days')::interval)::int AS active_accounts,
         (SELECT COUNT(*) FROM account_events WHERE kind = 'login_failed' AND created_at >= now() - ($1 || ' days')::interval)::int AS failed_logins,
         (SELECT COUNT(*) FROM game_registrations WHERE created_at >= now() - ($1 || ' days')::interval)::int AS bookings,
         (SELECT COUNT(*) FROM orders WHERE created_at >= now() - ($1 || ' days')::interval)::int AS orders,
         (SELECT COUNT(*) FROM audit_log WHERE created_at >= now() - ($1 || ' days')::interval)::int AS admin_actions`,
      [String(days)],
    );

    return NextResponse.json({ events, counts: counts ?? {}, days });
  } catch (err) {
    return serverError("activity", err);
  }
}
