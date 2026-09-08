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
