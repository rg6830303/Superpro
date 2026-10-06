import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { DAYS, VENUES } from "@/lib/coaching-program";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const fields = {
  coach_id: z.string().uuid(),
  name: z.string().trim().min(2, "Name the group").max(60),
  venue: z.enum(VENUES.map((v) => v.id) as [string, ...string[]], { message: "Pick a venue" }),
  days: z.array(z.enum(DAYS, { message: "Use full day names, e.g. Monday" })).min(1, "Pick at least one day"),
  start_time: z.string().regex(TIME, "Start time as HH:MM"),
  end_time: z.string().regex(TIME, "End time as HH:MM"),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  sessions: z.coerce.number().int().min(1).max(40),
};
const createSchema = z.object(fields).refine((g) => g.end_time > g.start_time, { message: "End time must be after start time" });
const patchSchema = z.object({ id: z.string().uuid(), ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])) });

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const groups = await query(
      `SELECT g.id, g.coach_id, c.name AS coach_name, g.name, g.venue, g.days, g.start_time, g.end_time,
              g.starts_on::text, g.sessions, g.created_at,
              COUNT(r.id) FILTER (WHERE r.status <> 'cancelled')::int AS members,
              COUNT(r.id) FILTER (WHERE r.status <> 'cancelled' AND r.payment_status = 'paid')::int AS paid
       FROM coaching_groups g JOIN coaches c ON c.id = g.coach_id
       LEFT JOIN coaching_registrations r ON r.group_id = g.id
       GROUP BY g.id, c.name ORDER BY g.starts_on DESC, g.start_time`,
    );
    return NextResponse.json({ groups });
  } catch (err) {
    return serverError("coaching-groups:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the group details.");
  try {
    const g = parsed.data;
    const row = await queryOne<{ id: string }>(
      `INSERT INTO coaching_groups (coach_id, name, venue, days, start_time, end_time, starts_on, sessions)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7::date,$8) RETURNING id`,
      [g.coach_id, g.name, g.venue, JSON.stringify(g.days), g.start_time, g.end_time, g.starts_on, g.sessions],
    );
    await audit(gate, "coaching_group.create", "coaching_groups", row!.id, { name: g.name });
    return NextResponse.json({ ok: true, id: row!.id });
  } catch (err) {
    return serverError("coaching-groups:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the group details.");
  try {
    const { id, ...p } = parsed.data as { id: string } & Record<string, unknown>;
    const row = await queryOne(
      `UPDATE coaching_groups SET
         coach_id = COALESCE($2, coach_id), name = COALESCE($3, name), venue = COALESCE($4, venue),
         days = COALESCE($5::jsonb, days), start_time = COALESCE($6, start_time), end_time = COALESCE($7, end_time),
         starts_on = COALESCE($8::date, starts_on), sessions = COALESCE($9, sessions)
       WHERE id = $1 RETURNING id`,
      [id, p.coach_id ?? null, p.name ?? null, p.venue ?? null, p.days ? JSON.stringify(p.days) : null,
       p.start_time ?? null, p.end_time ?? null, p.starts_on ?? null, p.sessions ?? null],
    );
    if (!row) return badRequest("That group no longer exists.");
    // Players follow their group if it moves to another coach.
    if (p.coach_id) await query(`UPDATE coaching_registrations SET coach_id = $1 WHERE group_id = $2`, [p.coach_id, id]);
    await audit(gate, "coaching_group.update", "coaching_groups", id, p);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("coaching-groups:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return badRequest("Missing group.");
  try {
    await query(
      `UPDATE coaching_registrations SET group_id = NULL, status = CASE WHEN status = 'grouped' THEN 'registered' ELSE status END WHERE group_id = $1`,
      [id],
    );
    await query(`DELETE FROM coaching_groups WHERE id = $1`, [id]);
    await audit(gate, "coaching_group.delete", "coaching_groups", id);
    return NextResponse.json({ ok: true, message: "Group deleted. Its players are back to Registered." });
  } catch (err) {
    return serverError("coaching-groups:delete", err);
  }
}
