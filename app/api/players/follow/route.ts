import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

async function target(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { handle?: string; id?: string };
  if (body.id) return { column: "id", value: body.id };
  if (body.handle) return { column: "lower(handle)", value: body.handle.toLowerCase() };
  return null;
}

export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in to follow players." }, { status: 401 });

  const who = await target(req);
  if (!who) return NextResponse.json({ error: "Which player?" }, { status: 400 });

  await ensureSchema();
  const rows = await query<{ id: string }>(
    `SELECT id FROM users WHERE ${who.column} = $1 AND handle IS NOT NULL LIMIT 1`,
    [who.value],
  );
  if (rows.length === 0) return NextResponse.json({ error: "No such player." }, { status: 404 });
  if (rows[0].id === session.id) {
    return NextResponse.json({ error: "You already keep up with yourself." }, { status: 400 });
  }

  // RETURNING is how we know this is a new follow rather than a repeat click.
  // Without it, follow → unfollow → follow pinged the other player every time.
  const inserted = await query<{ follower_id: string }>(
    `INSERT INTO follows (follower_id, following_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING RETURNING follower_id`,
    [session.id, rows[0].id],
  );

  if (inserted.length > 0) {
    // Only notify once per pair, ever: someone who unfollows and refollows has
    // already been announced, and a second ping is noise.
    const already = await query(
      `SELECT 1 FROM user_notifications WHERE user_id = $1 AND actor_id = $2 AND kind = 'follow' LIMIT 1`,
      [rows[0].id, session.id],
    ).catch(() => [{}]);
    if (already.length === 0) {
      const me = await query<{ handle: string | null; full_name: string | null }>(
        `SELECT handle, full_name FROM users WHERE id = $1`,
        [session.id],
      ).catch(() => []);
      const name = me[0]?.full_name || session.name || "A player";
      await createNotification({
        userId: rows[0].id,
        actorId: session.id,
        kind: "follow",
        title: `${name} followed you`,
        message: `${name} started following you on Sparvic. Follow back to see when they are on court.`,
        // To the follower, not the directory: the obvious next move is to look
        // at who it was and decide whether to follow back.
        linkUrl: me[0]?.handle ? `/players/${me[0].handle}` : "/players",
      }).catch(() => {});
    }
  }

  const [count] = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM follows WHERE following_id = $1`,
    [rows[0].id],
  );
  return NextResponse.json({ ok: true, following: true, followers: count?.n ?? 0 });
}

export async function DELETE(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const who = await target(req);
  if (!who) return NextResponse.json({ error: "Which player?" }, { status: 400 });

  await ensureSchema();
  const rows = await query<{ id: string }>(`SELECT id FROM users WHERE ${who.column} = $1 LIMIT 1`, [who.value]);
  if (rows.length === 0) return NextResponse.json({ error: "No such player." }, { status: 404 });

  await query(`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`, [session.id, rows[0].id]);
  const [count] = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM follows WHERE following_id = $1`,
    [rows[0].id],
  );
  return NextResponse.json({ ok: true, following: false, followers: count?.n ?? 0 });
}
