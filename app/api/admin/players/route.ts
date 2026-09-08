import { NextResponse } from "next/server";
import { adminGate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AdminPlayer = {
  id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  skill_level: string | null;
  dupr: number | null;
  role: string | null;
  wallet_balance_paise: number;
  games: number;
  last_seen: string | null;
  has_account: boolean;
};

/**
 * The player book: every Supabase-registered account, plus everyone who has
 * only ever booked as a guest (matched on phone). Registered rows carry the
 * wallet balance so the console can top it up in place.
 */
export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const q = new URL(req.url).searchParams.get("q");

    const accounts = await query<AdminPlayer>(
      `SELECT u.id, u.full_name, u.email, u.phone, u.skill_level, u.dupr, u.role,
              u.wallet_balance_paise::int AS wallet_balance_paise,
              COALESCE((SELECT COUNT(*) FROM game_registrations r
                        WHERE (r.user_id = u.id OR r.player_phone = u.phone)
                          AND r.status <> 'cancelled'), 0)::int AS games,
              GREATEST(u.created_at, COALESCE(u.last_login_at, u.created_at))::text AS last_seen,
              true AS has_account
       FROM users u
       WHERE ($1::text IS NULL OR u.full_name ILIKE '%' || $1 || '%'
              OR u.email ILIKE '%' || $1 || '%' OR u.phone ILIKE '%' || $1 || '%')
       ORDER BY u.created_at DESC
       LIMIT 300`,
      [q],
    );

    const knownPhones = accounts.map((a) => a.phone).filter(Boolean) as string[];

    const guests = await query<AdminPlayer>(
      `SELECT NULL::uuid AS id,
              r.player_name AS full_name,
              MAX(r.player_email) AS email,
              r.player_phone AS phone,
              MAX(r.skill_level) AS skill_level,
              NULL::numeric AS dupr,
              NULL::text AS role,
              0 AS wallet_balance_paise,
              COUNT(*)::int AS games,
              MAX(r.created_at)::text AS last_seen,
              false AS has_account
       FROM game_registrations r
       WHERE r.status <> 'cancelled'
         AND NOT (r.player_phone = ANY($1::text[]))
         AND ($2::text IS NULL OR r.player_name ILIKE '%' || $2 || '%' OR r.player_phone ILIKE '%' || $2 || '%')
       GROUP BY r.player_name, r.player_phone
       ORDER BY MAX(r.created_at) DESC
       LIMIT 200`,
      [knownPhones, q],
    );

    return NextResponse.json({
      players: [...accounts, ...guests],
      counts: { accounts: accounts.length, guests: guests.length },
    });
  } catch (err) {
    return serverError("players:list", err);
  }
}
