import { NextResponse } from "next/server";
import { adminGate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The player book. Registered accounts are unioned with everyone who has ever
 * booked a slot as a guest, keyed on phone number — so the club's actual
 * contact list is one table, not two.
 */
export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const q = new URL(req.url).searchParams.get("q");
    const players = await query(
      `WITH guests AS (
         SELECT player_name AS name, player_phone AS phone, MAX(player_email) AS email,
                MAX(skill_level) AS skill_level, COUNT(*)::int AS games, MAX(created_at) AS last_seen
         FROM game_registrations WHERE status <> 'cancelled'
         GROUP BY player_name, player_phone
       ),
       accounts AS (
         SELECT full_name AS name, phone, email, skill_level, 0 AS games, created_at AS last_seen
         FROM users
       )
       SELECT name, phone, email, skill_level, SUM(games)::int AS games, MAX(last_seen) AS last_seen,
              BOOL_OR(is_account) AS has_account
       FROM (
         SELECT name, phone, email, skill_level, games, last_seen, false AS is_account FROM guests
         UNION ALL
         SELECT name, phone, email, skill_level, games, last_seen, true AS is_account FROM accounts
       ) all_players
       WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR phone ILIKE '%' || $1 || '%')
       GROUP BY name, phone, email, skill_level
       ORDER BY MAX(last_seen) DESC NULLS LAST
       LIMIT 300`,
      [q],
    );
    return NextResponse.json({ players });
  } catch (err) {
    return serverError("players:list", err);
  }
}
