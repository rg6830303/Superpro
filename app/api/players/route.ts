import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type DirectoryPlayer = {
  id: string;
  handle: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  skill_level: string;
  dupr: number | null;
  followers: number;
  is_following: boolean;
};

/**
 * The player directory. Only ever returns the handful of columns a player has
 * chosen to make public — never email, phone, wallet or date of birth.
 */
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 24) || 24, 48);
    const session = await getPlayerSession();

    const players = await query<DirectoryPlayer>(
      `SELECT u.id, u.handle, u.full_name, u.avatar_url, u.city, u.skill_level, u.dupr,
              COALESCE((SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id), 0)::int AS followers,
              EXISTS (SELECT 1 FROM follows f2 WHERE f2.following_id = u.id AND f2.follower_id = $3::uuid) AS is_following
       FROM users u
       WHERE u.handle IS NOT NULL
         AND COALESCE(u.role, 'player') = 'player'
         AND ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.handle ILIKE '%' || $1 || '%'
              OR COALESCE(u.city, '') ILIKE '%' || $1 || '%')
       ORDER BY followers DESC, u.full_name
       LIMIT $2`,
      [q, limit, session?.id ?? null],
    );

    return NextResponse.json({ players });
  } catch (err) {
    console.error("[players]", err);
    return NextResponse.json({ players: [] });
  }
}
