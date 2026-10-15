import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { getLeaderboard } from "@/lib/leaderboard";
import { OPEN_CATEGORIES, partnerBlock } from "@/lib/sparvic-open";
import { factsOf, member, paidCategories, type Member } from "@/lib/sparvic-open-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partner search for a doubles category: registered Sparvic players matching
 * the query, with their club rank and doubles rating, and whether they can
 * pair with the viewer in this category (and why not).
 */
export async function GET(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const url = new URL(req.url);
  const cat = OPEN_CATEGORIES.find((c) => c.id === url.searchParams.get("category") && c.type === "doubles");
  if (!cat) return NextResponse.json({ error: "Pick a doubles category." }, { status: 400 });
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  try {
    await ensureSchema();
    const me = await member(session.id);
    if (!me) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const [rows, board] = await Promise.all([
      query<Member>(
        `SELECT id, full_name, email, phone, handle, avatar_url, gender, dupr, dupr_singles, dupr_doubles FROM users
         WHERE COALESCE(role,'player') = 'player' AND handle IS NOT NULL AND id <> $1
           AND ($2 = '' OR full_name ILIKE '%' || $2 || '%' OR handle ILIKE '%' || $2 || '%')
         ORDER BY COALESCE(dupr_doubles, dupr) DESC NULLS LAST, full_name LIMIT 25`,
        [session.id, q],
      ),
      getLeaderboard(null),
    ]);
    const rank = new Map(board.map((r) => [r.id, r.rank]));
    const players = await Promise.all(
      rows.map(async (p) => {
        let why = partnerBlock(cat, factsOf(me), factsOf(p), p.full_name.split(" ")[0]);
        if (!why && (await paidCategories(p.id)).has(cat.id)) why = `${p.full_name.split(" ")[0]} is already confirmed in this category.`;
        return {
          id: p.id,
          name: p.full_name,
          handle: p.handle,
          avatar_url: p.avatar_url,
          gender: p.gender,
          dupr_doubles: p.dupr_doubles != null ? Number(p.dupr_doubles) : p.dupr != null ? Number(p.dupr) : null,
          rank: rank.get(p.id) ?? null,
          eligible: !why,
          reason: why,
        };
      }),
    );
    // Eligible partners first, then by club rank.
    players.sort((a, b) => Number(b.eligible) - Number(a.eligible) || (a.rank ?? 1e9) - (b.rank ?? 1e9));
    return NextResponse.json({ players });
  } catch (err) {
    console.error("[sparvic-open/partners]", err);
    return NextResponse.json({ error: "Could not search players." }, { status: 500 });
  }
}
