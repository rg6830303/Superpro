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

  await query(
    `INSERT INTO follows (follower_id, following_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [session.id, rows[0].id],
  );

  createNotification({
    userId: rows[0].id,
    actorId: session.id,
    kind: "follow",
    title: "New Follower!",
    message: `${session.name} started following you on SuperPro.`,
    linkUrl: `/players`,
  }).catch(() => {});

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
