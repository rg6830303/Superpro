import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["name", "area", "address", "courts", "maps_url", "active", "sort_order"] as const;

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const venues = await query(`SELECT * FROM venues ORDER BY sort_order, name`);
    return NextResponse.json({ venues });
  } catch (err) {
    return serverError("venues:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.name) return badRequest("Venue name is required.");
    const rows = await query<{ id: string }>(
      `INSERT INTO venues (name, area, address, courts, maps_url, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,true,$6) RETURNING id`,
      [body.name, body.area ?? null, body.address ?? null, Number(body.courts ?? 2), body.maps_url ?? null, Number(body.sort_order ?? 0)],
    );
    await audit(gate, "venue.create", "venues", rows[0].id, { name: body.name });
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    return serverError("venues:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing venue id.");
    const update = buildUpdate("venues", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    await query(update.text, update.params);
    await audit(gate, "venue.update", "venues", String(body.id), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("venues:update", err);
  }
}

/**
 * Delete a venue. Refused while games still reference it, because the cascade
 * would silently take those sessions and their bookings with it — deactivate
 * instead, which hides it from the site and keeps the history.
 */
export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing venue id.");
    const used = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM game_sessions WHERE venue_id = $1`,
      [id],
    );
    if (Number(used[0]?.n ?? 0) > 0) {
      await query(`UPDATE venues SET active = false WHERE id = $1`, [id]);
      await audit(gate, "venue.deactivate", "venues", id);
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: `${used[0].n} games use this venue, so it was hidden rather than deleted.`,
      });
    }
    await query(`DELETE FROM venues WHERE id = $1`, [id]);
    await audit(gate, "venue.delete", "venues", id);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return serverError("venues:delete", err);
  }
}
