import { NextResponse } from "next/server";
import { dbConnInfo, isDbConfigured } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { seedAll } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot database bootstrap: creates every table/index, then seeds the
 * catalogue, venues, coaches, tournaments and a week of game slots.
 *
 * Protected by SEED_TOKEN — pass it as `?token=` or an Authorization bearer.
 * Safe to run repeatedly: the schema uses IF NOT EXISTS and every seed insert
 * is ON CONFLICT DO NOTHING, so it never overwrites live data.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const provided = url.searchParams.get("token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.SEED_TOKEN;

  if (!expected) {
    return NextResponse.json(
      { error: "SEED_TOKEN is not set on the server. Set it in Vercel and redeploy." },
      { status: 503 },
    );
  }
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  if (!isDbConfigured) {
    return NextResponse.json({ error: "POSTGRES_URL is not set." }, { status: 503 });
  }

  try {
    await ensureSchema(true);
    const seeded = await seedAll();
    return NextResponse.json({ ok: true, db: dbConnInfo(), seeded });
  } catch (err) {
    console.error("[db-init]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bootstrap failed." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST /api/db-init?token=$SEED_TOKEN — creates the schema and seeds starter data.",
    db: dbConnInfo(),
  });
}
