import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, jsonbFields, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["label", "type", "options", "required", "help", "sort_order", "field_key"] as const;

/** Turns a label into a stable, collision-free key for the answers map. */
function toKey(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `field_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The per-tournament entry form. Admins add whatever a given draw needs — shirt
 * size, partner's DUPR, a waiver tick — and the public form renders those
 * fields underneath the details we already hold about the player.
 */
export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const tournamentId = new URL(req.url).searchParams.get("tournament_id");
    if (!tournamentId) return badRequest("Missing tournament id.");
    const fields = await query(
      `SELECT * FROM tournament_form_fields WHERE tournament_id = $1 ORDER BY sort_order, created_at`,
      [tournamentId],
    );
    return NextResponse.json({ fields });
  } catch (err) {
    return serverError("tournament-form:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.tournament_id) return badRequest("Missing tournament id.");
    const label = String(body.label ?? "").trim();
    if (label.length < 2) return badRequest("Give the question a label.");

    let key = String(body.field_key ?? "").trim() || toKey(label);
    // Keys must be unique per tournament; suffix rather than reject.
    const clash = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tournament_form_fields WHERE tournament_id = $1 AND field_key = $2`,
      [body.tournament_id, key],
    );
    if (Number(clash[0]?.n ?? 0) > 0) key = `${key}_${Math.random().toString(36).slice(2, 5)}`;

    const rows = await query<{ id: string }>(
      `INSERT INTO tournament_form_fields (tournament_id, field_key, label, type, options, required, help, sort_order)
       VALUES ($1,$2,$3,$4,COALESCE($5,'[]')::jsonb,$6,$7,$8)
       RETURNING id`,
      [
        body.tournament_id,
        key,
        label,
        body.type ?? "text",
        body.options ? JSON.stringify(body.options) : null,
        Boolean(body.required),
        body.help ?? null,
        Number(body.sort_order ?? 0),
      ],
    );
    await audit(gate, "form-field.create", "tournament_form_fields", rows[0].id, { label, key });
    return NextResponse.json({ ok: true, id: rows[0].id, field_key: key });
  } catch (err) {
    return serverError("tournament-form:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = jsonbFields((await req.json().catch(() => ({}))) as Record<string, unknown>, ["options"]);
    if (!body.id) return badRequest("Missing field id.");
    const update = buildUpdate("tournament_form_fields", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    await query(update.text, update.params);
    await audit(gate, "form-field.update", "tournament_form_fields", String(body.id), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("tournament-form:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing field id.");
    // Answers already collected stay on their registrations; only the question
    // stops being asked from here on.
    await query(`DELETE FROM tournament_form_fields WHERE id = $1`, [id]);
    await audit(gate, "form-field.delete", "tournament_form_fields", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("tournament-form:delete", err);
  }
}
