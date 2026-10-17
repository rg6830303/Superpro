import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { OPEN_CATEGORIES, categoryBlock } from "@/lib/sparvic-open";
import { factsOf, member, paidCategories } from "@/lib/sparvic-open-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Seeker = { id: string; name: string; handle: string | null; avatar_url: string | null; gender: string | null; dupr_doubles: number | null; phone: string | null };

/** The viewer's "need a partner" categories, and everyone else on those boards. */
async function boards(userId: string) {
  const mine = (await query<{ category: string }>(`SELECT category FROM open_partner_seekers WHERE user_id = $1`, [userId])).map((r) => r.category);
  const rows = mine.length
    ? await query<Seeker & { category: string; dupr: number | null }>(
        `SELECT s.category, u.id, u.full_name AS name, u.handle, u.avatar_url, u.gender, u.dupr_doubles, u.dupr, u.phone
         FROM open_partner_seekers s JOIN users u ON u.id = s.user_id
         WHERE s.category = ANY($1) AND s.user_id <> $2
         ORDER BY s.created_at`,
        [mine, userId],
      )
    : [];
  const groups: Record<string, Seeker[]> = Object.fromEntries(mine.map((c) => [c, []]));
  for (const r of rows) {
    groups[r.category].push({
      id: r.id, name: r.name, handle: r.handle, avatar_url: r.avatar_url, gender: r.gender, phone: r.phone,
      dupr_doubles: r.dupr_doubles != null ? Number(r.dupr_doubles) : r.dupr != null ? Number(r.dupr) : null,
    });
  }
  return { mine, groups };
}

export async function GET() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    await ensureSchema();
    return NextResponse.json(await boards(session.id));
  } catch (err) {
    console.error("[sparvic-open/seekers]", err);
    return NextResponse.json({ error: "Could not load the partner board." }, { status: 500 });
  }
}

const Body = z.object({ categories: z.array(z.string()).max(OPEN_CATEGORIES.length) });

/** Replace the viewer's "need a partner" categories (eligible doubles only). */
export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick your categories." }, { status: 400 });
  try {
    await ensureSchema();
    const me = await member(session.id);
    if (!me) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const paid = await paidCategories(session.id);
    const wanted = [...new Set(parsed.data.categories)];
    for (const id of wanted) {
      const cat = OPEN_CATEGORIES.find((c) => c.id === id && c.type === "doubles");
      if (!cat) return NextResponse.json({ error: "Only doubles categories need a partner." }, { status: 400 });
      const why = paid.has(id) ? "you're already confirmed here" : categoryBlock(cat, factsOf(me));
      if (why) return NextResponse.json({ error: `${cat.label}: ${why}.` }, { status: 400 });
    }
    await query(`DELETE FROM open_partner_seekers WHERE user_id = $1 AND NOT (category = ANY($2))`, [session.id, wanted]);
    if (wanted.length) {
      await query(
        `INSERT INTO open_partner_seekers (user_id, category) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
        [session.id, wanted],
      );
    }
    return NextResponse.json(await boards(session.id));
  } catch (err) {
    console.error("[sparvic-open/seekers]", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
