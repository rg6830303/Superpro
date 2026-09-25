import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, jsonbFields, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = [
  "name",
  "slug",
  "headline",
  "bio",
  "specialties",
  "dupr",
  "experience_years",
  "rate_paise",
  "languages",
  "image_url",
  "whatsapp",
  "email",
  "available_days",
  "active",
  "sort_order",
] as const;

/** The login email for a coach: trimmed, lower-cased, and null when blank. */
function coachEmail(v: unknown): string | null {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const coaches = await query(
      `SELECT c.*,
              COALESCE((SELECT COUNT(*) FROM coaching_bookings b
                        WHERE b.coach_id = c.id AND b.status <> 'cancelled'), 0)::int AS bookings,
              EXISTS (SELECT 1 FROM coach_accounts a WHERE a.coach_id = c.id) AS has_login
       FROM coaches c ORDER BY c.sort_order, c.name`,
    );
    return NextResponse.json({ coaches });
  } catch (err) {
    return serverError("coaches:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.name || !body.slug) return badRequest("Name and slug are required.");
    const rows = await query<{ id: string }>(
      `INSERT INTO coaches (slug, name, headline, bio, specialties, dupr, experience_years, rate_paise,
         languages, image_url, whatsapp, available_days, active, sort_order, email)
       VALUES ($1,$2,$3,$4,COALESCE($5,'[]')::jsonb,$6,$7,$8,$9,$10,$11,COALESCE($12,'[]')::jsonb,$13,$14,$15)
       RETURNING id`,
      [
        body.slug,
        body.name,
        body.headline ?? null,
        body.bio ?? null,
        body.specialties ? JSON.stringify(body.specialties) : null,
        body.dupr ? Number(body.dupr) : null,
        Number(body.experience_years ?? 1),
        Number(body.rate_paise ?? 120000),
        body.languages ?? null,
        body.image_url ?? null,
        body.whatsapp ?? null,
        body.available_days ? JSON.stringify(body.available_days) : null,
        body.active === false ? false : true,
        Number(body.sort_order ?? 0),
        coachEmail(body.email),
      ],
    );
    await audit(gate, "coach.create", "coaches", rows[0].id, { name: body.name });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    return serverError("coaches:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = jsonbFields((await req.json().catch(() => ({}))) as Record<string, unknown>, [
      "specialties",
      "available_days",
    ]);
    if (!body.id) return badRequest("Missing coach id.");
    if ("email" in body) body.email = coachEmail(body.email);
    const update = buildUpdate("coaches", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    const rows = await query(update.text, update.params);
    await audit(gate, "coach.update", "coaches", String(body.id), body);
    return NextResponse.json({ ok: true, coach: rows[0] ?? null });
  } catch (err) {
    return serverError("coaches:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const params = new URL(req.url).searchParams;
    const id = params.get("id");
    if (!id) return badRequest("Missing coach id.");

    // Remove means remove — unless the coach has bookings on record (which
    // reference them with ON DELETE RESTRICT), in which case they are hidden
    // from the site and their portal login is closed, so the history keeps its
    // coach. The response says which one happened.
    const booked = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM coaching_bookings WHERE coach_id = $1`,
      [id],
    );
    if (Number(booked[0]?.n ?? 0) === 0) {
      await query(`DELETE FROM coaches WHERE id = $1`, [id]);
      await audit(gate, "coach.delete", "coaches", id);
      return NextResponse.json({ ok: true, deleted: true });
    }
    await query(`UPDATE coaches SET active = false WHERE id = $1`, [id]);
    await query(`DELETE FROM coach_accounts WHERE coach_id = $1`, [id]);
    await audit(gate, "coach.deactivate", "coaches", id);
    return NextResponse.json({
      ok: true,
      deactivated: true,
      message: "This coach has bookings on record, so they were hidden from the site and their login closed rather than deleted.",
    });
  } catch (err) {
    return serverError("coaches:delete", err);
  }
}
