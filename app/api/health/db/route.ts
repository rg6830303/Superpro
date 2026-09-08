import { NextResponse } from "next/server";
import { dbConnInfo, dbPing } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment smoke test. Surfaces the pooler verdict (not the host or
 * credentials) so a bad POSTGRES_URL is obvious from the browser.
 */
export async function GET() {
  const conn = dbConnInfo();
  const ping = conn.configured ? await dbPing() : { ok: false, latencyMs: 0, error: "POSTGRES_URL is not set" };
  return NextResponse.json(
    {
      ok: ping.ok,
      db: { ...conn, ...ping },
      warning: conn.configured && !conn.pooled
        ? "POSTGRES_URL is not the Supabase transaction pooler (:6543). Serverless will exhaust connections."
        : undefined,
    },
    { status: ping.ok ? 200 : 503 },
  );
}
