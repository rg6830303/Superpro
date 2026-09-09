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
  "available_days",
  "active",
  "sort_order",
] as const;

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const coaches = await query(
      `SELECT c.*,
              COALESCE((SELECT COUNT(*) FROM coaching_bookings b
                        WHERE b.coach_id = c.id AND b.status <> 'cancelled'), 0)::int AS bookings
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
         languages, image_url, whatsapp, available_days, active, sort_order)
       VALUES ($1,$2,$3,$4,COALESCE($5,'[]')::jsonb,$6,$7,$8,$9,$10,$11,COALESCE($12,'[]')::jsonb,$13,$14)
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

    // Bookings reference the coach with ON DELETE RESTRICT, so deactivating is
    // the default. `purge=1` removes a coach who never took a booking.
    if (params.get("purge") === "1") {
      const booked = await query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM coaching_bookings WHERE coach_id = $1`,
        [id],
      );
      if (Number(booked[0]?.n ?? 0) > 0) {
        return NextResponse.json(
          { error: "This coach has bookings on record. Hide them from the site instead of deleting." },
          { status: 409 },
        );
      }
      await query(`DELETE FROM coaches WHERE id = $1`, [id]);
      await audit(gate, "coach.delete", "coaches", id);
      return NextResponse.json({ ok: true, deleted: true });
    }

    await query(`UPDATE coaches SET active = false WHERE id = $1`, [id]);
    await audit(gate, "coach.deactivate", "coaches", id);
    return NextResponse.json({ ok: true, deactivated: true });
  } catch (err) {
    return serverError("coaches:delete", err);
  }
}
