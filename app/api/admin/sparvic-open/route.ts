import { NextResponse } from "next/server";
import { adminGate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import type { OpenEntry } from "@/lib/sparvic-open-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every Sparvic Open entry, newest first, for the organisers. */
export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const entries = await query<OpenEntry>(`SELECT * FROM open_entries ORDER BY created_at DESC`);
    return NextResponse.json({ entries });
  } catch (err) {
    return serverError("sparvic-open:list", err);
  }
}
