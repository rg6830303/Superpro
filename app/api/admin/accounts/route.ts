import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Account monitoring: every player and every coach portal login, with when
 * they joined, when they were last seen, how many sign-ins and failed sign-ins
 * they have had in 30 days, and what they have done on the platform.
 */
export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const type = new URL(req.url).searchParams.get("type") === "coaches" ? "coaches" : "players";

    if (type === "coaches") {
      const coaches = await query(
        `SELECT c.id AS coach_id, c.name, c.email AS roster_email, c.active,
                a.id AS account_id, a.email AS login_email, a.created_at::text AS joined_at,
                a.last_login_at::text AS last_login_at,
                (SELECT COUNT(*) FROM account_events e WHERE e.actor_type = 'coach' AND e.actor_id = c.id
                   AND e.kind = 'login' AND e.created_at >= now() - interval '30 days')::int AS logins_30d,
                (SELECT COUNT(*) FROM account_events e WHERE e.actor_type = 'coach'
                   AND (e.actor_id = c.id OR e.email = lower(c.email))
                   AND e.kind = 'login_failed' AND e.created_at >= now() - interval '30 days')::int AS failed_30d,
                (SELECT COUNT(*) FROM coaching_bookings b WHERE b.coach_id = c.id)::int AS bookings,
                (SELECT COUNT(*) FROM coaching_bookings b WHERE b.coach_id = c.id AND b.status = 'requested')::int AS awaiting
         FROM coaches c
         LEFT JOIN coach_accounts a ON a.coach_id = c.id
         ORDER BY a.last_login_at DESC NULLS LAST, c.name`,
      );
      return NextResponse.json({ type, coaches });
    }

    const players = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.handle, u.role, u.skill_level,
              u.created_at::text AS joined_at, u.last_login_at::text AS last_login_at,
              u.wallet_balance_paise,
              (SELECT COUNT(*) FROM account_events e WHERE e.actor_type = 'player' AND e.actor_id = u.id
                 AND e.kind = 'login' AND e.created_at >= now() - interval '30 days')::int AS logins_30d,
              (SELECT COUNT(*) FROM account_events e WHERE e.actor_type = 'player' AND e.email = lower(u.email)
                 AND e.kind = 'login_failed' AND e.created_at >= now() - interval '30 days')::int AS failed_30d,
              (SELECT COUNT(*) FROM game_registrations r WHERE r.user_id = u.id)::int AS bookings,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id)::int AS orders,
              (SELECT COUNT(*) FROM coaching_bookings b WHERE b.user_id = u.id)::int AS coaching,
              (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id)::int AS followers,
              GREATEST(u.last_login_at,
                (SELECT MAX(r.created_at) FROM game_registrations r WHERE r.user_id = u.id),
                (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id))::text AS last_active_at
       FROM users u
       ORDER BY GREATEST(u.last_login_at, u.created_at) DESC NULLS LAST`,
    );
    return NextResponse.json({ type, players });
  } catch (err) {
    return serverError("accounts", err);
  }
}

/**
 * Revoke a coach's portal login. Their bookings and profile stay; they are
 * signed out on their next request and cannot sign in again until they set up
 * a new login — which also needs the roster email, so clear that too to keep
 * them out for good.
 */
export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const url = new URL(req.url);
    const coachId = url.searchParams.get("coach_id");
    if (!coachId) return badRequest("Which coach?");
    const account = await queryOne<{ email: string }>(`SELECT email FROM coach_accounts WHERE coach_id = $1`, [coachId]);
    if (!account) return badRequest("That coach has no portal login.");
    await query(`DELETE FROM coach_accounts WHERE coach_id = $1`, [coachId]);
    if (url.searchParams.get("clear_email") === "1") {
      await query(`UPDATE coaches SET email = NULL WHERE id = $1`, [coachId]);
    }
    await audit(gate, "coach_login.revoke", "coaches", coachId, { email: account.email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("accounts:revoke", err);
  }
}
