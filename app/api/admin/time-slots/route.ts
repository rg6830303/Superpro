import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["label", "start_time", "end_time", "sort_order", "active"] as const;

/**
 * The reusable slot library. Daily games are composed from these rather than
 * from times typed in each time, so "18:00–19:00" means the same thing at every
 * venue and a new slot only has to be defined once.
 */
export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const slots = await query(`SELECT * FROM time_slots ORDER BY sort_order, start_time`);
    return NextResponse.json({ slots });
  } catch (err) {
    return serverError("time-slots:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.start_time || !body.end_time) return badRequest("Start and end time are required.");
    if (String(body.end_time) <= String(body.start_time)) {
      return badRequest("The end time has to be after the start time.");
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO time_slots (label, start_time, end_time, sort_order, active)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (start_time, end_time) DO UPDATE SET active = true, label = EXCLUDED.label
       RETURNING id`,
      [
        body.label ?? null,
        body.start_time,
        body.end_time,
        Number(body.sort_order ?? 0),
        body.active === false ? false : true,
      ],
    );
    await audit(gate, "time-slot.create", "time_slots", rows[0]?.id, {
      start: body.start_time,
      end: body.end_time,
    });
    return NextResponse.json({ ok: true, id: rows[0]?.id });
  } catch (err) {
    return serverError("time-slots:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing slot id.");
    const update = buildUpdate("time_slots", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    await query(update.text, update.params);
    await audit(gate, "time-slot.update", "time_slots", String(body.id), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("time-slots:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing slot id.");
    // Sessions already built from this template keep their own times, so the
    // template can be retired without touching the schedule.
    await query(`DELETE FROM time_slots WHERE id = $1`, [id]);
    await audit(gate, "time-slot.delete", "time_slots", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("time-slots:delete", err);
  }
}
