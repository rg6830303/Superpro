import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["coach_id", "weekday", "start_time", "end_time", "active"] as const;

/**
 * A coach's recurring weekly availability. Players never book one of these
 * directly — the coaching flow shows them so a player knows roughly when the
 * coach is around, and the actual date is agreed with the coach afterwards.
 */
export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const coachId = new URL(req.url).searchParams.get("coach_id");
    const slots = await query(
      `SELECT a.id, a.coach_id, a.weekday, a.start_time::text AS start_time, a.end_time::text AS end_time,
              a.active, c.name AS coach_name
       FROM coach_availability a
       JOIN coaches c ON c.id = a.coach_id
       ${coachId ? "WHERE a.coach_id = $1" : ""}
       ORDER BY c.sort_order, c.name, a.weekday, a.start_time`,
      coachId ? [coachId] : [],
    );
    return NextResponse.json({ slots });
  } catch (err) {
    return serverError("coach-availability:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.coach_id) return badRequest("Pick a coach.");
    if (!body.start_time || !body.end_time) return badRequest("Start and end time are required.");
    if (String(body.end_time) <= String(body.start_time)) {
      return badRequest("The end time has to be after the start time.");
    }

    // Several weekdays at once, so "Mon/Wed/Fri evenings" is one action.
    const raw = Array.isArray(body.weekdays) ? body.weekdays : [body.weekday ?? 1];
    const weekdays = [...new Set(raw.map((d) => Number(d)))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (weekdays.length === 0) return badRequest("Pick at least one day.");

    for (const weekday of weekdays) {
      await query(
        `INSERT INTO coach_availability (coach_id, weekday, start_time, end_time, active)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (coach_id, weekday, start_time)
         DO UPDATE SET end_time = EXCLUDED.end_time, active = EXCLUDED.active`,
        [body.coach_id, weekday, body.start_time, body.end_time, body.active === false ? false : true],
      );
    }

    await audit(gate, "coach-availability.create", "coach_availability", String(body.coach_id), {
      weekdays,
      start: body.start_time,
      end: body.end_time,
    });
    return NextResponse.json({ ok: true, created: weekdays.length });
  } catch (err) {
    return serverError("coach-availability:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing slot id.");
    if (body.start_time && body.end_time && String(body.end_time) <= String(body.start_time)) {
      return badRequest("The end time has to be after the start time.");
    }
    const update = buildUpdate("coach_availability", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    await query(update.text, update.params);
    await audit(gate, "coach-availability.update", "coach_availability", String(body.id), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("coach-availability:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing slot id.");
    await query(`DELETE FROM coach_availability WHERE id = $1`, [id]);
    await audit(gate, "coach-availability.delete", "coach_availability", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("coach-availability:delete", err);
  }
}
