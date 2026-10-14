import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";
import { getLeaderboard } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live standings for the clubhouse leaderboard. Members only. */
export async function GET(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await ensureSchema();
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 500) || 500, 500);
  const all = await getLeaderboard(session.id);
  const me = all.find((r) => r.id === session.id) ?? null;
  return NextResponse.json(
    { rows: all.slice(0, limit), me, total: all.length, at: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
