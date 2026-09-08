import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["status", "payment_status", "group_id", "seed", "category", "notes"] as const;

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const tournamentId = new URL(req.url).searchParams.get("tournament_id");
    if (!tournamentId) return badRequest("Missing tournament id.");
    const registrations = await query(
      `SELECT r.*, g.name AS group_name
       FROM tournament_registrations r
       LEFT JOIN tournament_groups g ON g.id = r.group_id
       WHERE r.tournament_id = $1
       ORDER BY r.seed NULLS LAST, r.created_at`,
      [tournamentId],
    );
    return NextResponse.json({ registrations });
  } catch (err) {
    return serverError("tournament-regs:list", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing registration id.");
    const update = buildUpdate("tournament_registrations", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    const rows = await query(update.text, update.params);
    await audit(gate, "tournament-reg.update", "tournament_registrations", String(body.id), body);
    return NextResponse.json({ ok: true, registration: rows[0] ?? null });
  } catch (err) {
    return serverError("tournament-regs:update", err);
  }
}
