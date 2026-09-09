import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { addDays, istToday } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = [
  "start_time",
  "end_time",
  "court_number",
  "level",
  "capacity",
  "price_paise",
  "pricing_mode",
  "court_fee_paise",
  "status",
  "notes",
] as const;

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const params = new URL(req.url).searchParams;
    const from = params.get("from") ?? istToday();
    const to = params.get("to") ?? addDays(from, 13);
    const sessions = await query(
      `SELECT s.*, s.session_date::text AS session_date, v.name AS venue_name, v.area AS venue_area,
              COALESCE((SELECT SUM(players_count) FROM game_registrations r
                        WHERE r.session_id = s.id AND r.status <> 'cancelled'), 0)::int AS booked
       FROM game_sessions s JOIN venues v ON v.id = s.venue_id
       WHERE s.session_date BETWEEN $1 AND $2
       ORDER BY s.session_date, s.start_time, v.sort_order, s.court_number`,
      [from, to],
    );
    return NextResponse.json({ sessions });
  } catch (err) {
    return serverError("sessions:list", err);
  }
}

/**
 * Create slots. Two shapes:
 *   { venue_id, session_date, start_time, end_time, ... }         → one slot
 *   { venue_id, dates: [...], times: [{start,end}], courts: n }    → bulk grid
 */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const venueIds: string[] = Array.isArray(body.venue_ids)
      ? (body.venue_ids as string[])
      : body.venue_id
        ? [body.venue_id as string]
        : [];
    if (venueIds.length === 0) return badRequest("Pick at least one venue.");

    const level = (body.level as string) ?? "all";
    const capacity = Number(body.capacity ?? 8);
    const price = Number(body.price_paise ?? 35000);
    // "split" divides a court's hourly fee across the slot's capacity; "fixed"
    // charges the per-player price directly.
    const pricingMode = body.pricing_mode === "split" ? "split" : "fixed";
    const courtFee = Number(body.court_fee_paise ?? 0);

    const dates: string[] = Array.isArray(body.dates)
      ? (body.dates as string[])
      : body.session_date
        ? [body.session_date as string]
        : [];
    let times: Array<{ start: string; end: string }> = Array.isArray(body.times)
      ? (body.times as Array<{ start: string; end: string }>)
      : body.start_time && body.end_time
        ? [{ start: body.start_time as string, end: body.end_time as string }]
        : [];

    // Slots can be picked from the reusable library instead of retyped.
    if (Array.isArray(body.time_slot_ids) && (body.time_slot_ids as string[]).length > 0) {
      const picked = await query<{ start_time: string; end_time: string }>(
        `SELECT start_time, end_time FROM time_slots WHERE id = ANY($1::uuid[]) ORDER BY sort_order, start_time`,
        [body.time_slot_ids],
      );
      times = picked.map((t) => ({ start: t.start_time, end: t.end_time }));
    }
    const courts = Number(body.courts ?? body.court_number ?? 1);
    const courtList = Array.isArray(body.court_numbers)
      ? (body.court_numbers as number[])
      : Array.from({ length: courts }, (_, i) => (body.court_number ? Number(body.court_number) : i + 1));

    if (dates.length === 0 || times.length === 0) return badRequest("Pick at least one date and time.");

    let created = 0;
    for (const date of dates) {
      for (const venueId of venueIds) {
        for (const t of times) {
          for (const court of courtList) {
            const rows = await query<{ id: string }>(
              `INSERT INTO game_sessions (venue_id, session_date, start_time, end_time, court_number,
               level, capacity, price_paise, pricing_mode, court_fee_paise, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open')
             ON CONFLICT (venue_id, session_date, start_time, court_number) DO NOTHING
             RETURNING id`,
              [venueId, date, t.start, t.end, court, level, capacity, price, pricingMode, courtFee],
            );
            created += rows.length;
          }
        }
      }
    }

    await audit(gate, "session.create", "game_sessions", undefined, {
      created,
      venues: venueIds.length,
      dates: dates.length,
      times: times.length,
      courts: courtList.length,
    });
    return NextResponse.json({ ok: true, created });
  } catch (err) {
    return serverError("sessions:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing session id.");
    const update = buildUpdate("game_sessions", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    const rows = await query(update.text, update.params);
    await audit(gate, "session.update", "game_sessions", String(body.id), body);
    return NextResponse.json({ ok: true, session: rows[0] ?? null });
  } catch (err) {
    return serverError("sessions:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing session id.");

    // Refuse to delete a slot people have booked — cancel it instead, so the
    // registrations (and their payment records) survive.
    const booked = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM game_registrations WHERE session_id = $1 AND status <> 'cancelled'`,
      [id],
    );
    if (Number(booked[0]?.n ?? 0) > 0) {
      await query(`UPDATE game_sessions SET status = 'cancelled' WHERE id = $1`, [id]);
      await audit(gate, "session.cancel", "game_sessions", id);
      return NextResponse.json({ ok: true, cancelled: true });
    }

    await query(`DELETE FROM game_sessions WHERE id = $1`, [id]);
    await audit(gate, "session.delete", "game_sessions", id);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return serverError("sessions:delete", err);
  }
}
