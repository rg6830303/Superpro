import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, jsonbFields, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = [
  "title",
  "slug",
  "kind",
  "status",
  "start_date",
  "end_date",
  "venue",
  "city",
  "format",
  "categories",
  "prize_pool_paise",
  "entry_fee_paise",
  "max_teams",
  "dupr_cap",
  "banner_url",
  "summary",
  "description",
  "result_note",
  "registration_open",
  "partner_name",
] as const;

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const tournaments = await query(
      `SELECT t.*,
              COALESCE((SELECT COUNT(*) FROM tournament_registrations r
                        WHERE r.tournament_id = t.id AND r.status <> 'withdrawn'), 0)::int AS teams
       FROM tournaments t ORDER BY t.start_date DESC NULLS LAST`,
    );
    return NextResponse.json({ tournaments });
  } catch (err) {
    return serverError("tournaments:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.title || !body.slug) return badRequest("Title and slug are required.");
    const rows = await query<{ id: string }>(
      `INSERT INTO tournaments (slug, title, kind, status, start_date, end_date, venue, city, format,
         categories, prize_pool_paise, entry_fee_paise, max_teams, dupr_cap, banner_url, summary,
         description, result_note, registration_open, partner_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'[]')::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        body.slug,
        body.title,
        body.kind ?? "organized",
        body.status ?? "announced",
        body.start_date || null,
        body.end_date || null,
        body.venue ?? null,
        body.city ?? "Kolkata",
        body.format ?? null,
        body.categories ? JSON.stringify(body.categories) : null,
        Number(body.prize_pool_paise ?? 0),
        Number(body.entry_fee_paise ?? 0),
        Number(body.max_teams ?? 16),
        body.dupr_cap ? Number(body.dupr_cap) : null,
        body.banner_url ?? null,
        body.summary ?? null,
        body.description ?? null,
        body.result_note ?? null,
        Boolean(body.registration_open),
        body.partner_name ?? null,
      ],
    );
    await audit(gate, "tournament.create", "tournaments", rows[0].id, { title: body.title });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    return serverError("tournaments:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = jsonbFields((await req.json().catch(() => ({}))) as Record<string, unknown>, ["categories"]);
    if (!body.id) return badRequest("Missing tournament id.");
    const update = buildUpdate("tournaments", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    const rows = await query(update.text, update.params);
    await audit(gate, "tournament.update", "tournaments", String(body.id), body);
    return NextResponse.json({ ok: true, tournament: rows[0] ?? null });
  } catch (err) {
    return serverError("tournaments:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing tournament id.");
    await query(`UPDATE tournaments SET status = 'cancelled', registration_open = false WHERE id = $1`, [id]);
    await audit(gate, "tournament.cancel", "tournaments", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("tournaments:delete", err);
  }
}
