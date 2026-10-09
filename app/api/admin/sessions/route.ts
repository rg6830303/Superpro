import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { addDays, istToday } from "@/lib/dates";
import { MAX_OCCUPANCY, promoteWaitlist } from "@/lib/slot-rules";
import { ensureSchema } from "@/lib/schema";
import { formatDate, formatTimeRange } from "@/lib/dates";
import { createNotification } from "@/lib/notifications";
import { sendWhatsApp } from "@/lib/whatsapp";

type SlotWhere = { venue_id: string; venue_name: string; session_date: string; start_time: string; end_time: string; court_number: number };
async function slotWhere(id: string): Promise<SlotWhere | null> {
  const rows = await query<SlotWhere>(
    `SELECT s.venue_id, v.name AS venue_name, s.session_date::text AS session_date, s.start_time, s.end_time, s.court_number
     FROM game_sessions s JOIN venues v ON v.id = s.venue_id WHERE s.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
const describe = (w: SlotWhere) => `${formatDate(w.session_date)} · ${formatTimeRange(w.start_time, w.end_time)} · ${w.venue_name} Court ${w.court_number}`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = [
  "venue_id",
  "session_date",
  "start_time",
  "end_time",
  "court_number",
  "level",
  "mixed_doubles",
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
    await ensureSchema();
    const params = new URL(req.url).searchParams;
    const from = params.get("from") ?? istToday();
    const to = params.get("to") ?? addDays(from, 13);
    const sessions = await query(
      `SELECT s.*, s.session_date::text AS session_date, v.name AS venue_name, v.area AS venue_area,
              COALESCE((SELECT SUM(players_count) FROM game_registrations r
                        WHERE r.session_id = s.id AND r.status IN ('confirmed','pending_approval')), 0)::int AS booked,
              (SELECT COUNT(*) FROM game_registrations r WHERE r.session_id = s.id AND r.status = 'waitlist')::int AS waitlist,
              COALESCE((SELECT SUM(r.players_count) FROM game_registrations r LEFT JOIN users u ON u.id = r.user_id
                        WHERE r.session_id = s.id AND r.status IN ('confirmed','pending_approval')
                          AND lower(COALESCE(r.player_gender, u.gender)) = 'male'), 0)::int AS male,
              COALESCE((SELECT SUM(r.players_count) FROM game_registrations r LEFT JOIN users u ON u.id = r.user_id
                        WHERE r.session_id = s.id AND r.status IN ('confirmed','pending_approval')
                          AND lower(COALESCE(r.player_gender, u.gender)) = 'female'), 0)::int AS female
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
    await ensureSchema();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // ── Multi-venue planner ────────────────────────────────────────────────
    // { dates: [...], plan: [{ venue_id, courts: [1,2], times: [{start,end}] }],
    //   level, mixed_doubles, capacity, pricing_mode, price_paise, court_fee_paise }
    if (Array.isArray(body.plan)) {
      const DATE = /^\d{4}-\d{2}-\d{2}$/;
      const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
      const dates = (Array.isArray(body.dates) ? body.dates : []).filter((d): d is string => typeof d === "string" && DATE.test(d));
      if (dates.length === 0) return badRequest("Pick at least one date.");
      if (dates.length > 62) return badRequest("Plan at most two months at a time.");
      const level = ["all", "beginner", "intermediate", "advanced"].includes(String(body.level)) ? String(body.level) : "all";
      const mixed = body.mixed_doubles === true;
      const capacity = Math.max(1, Math.min(MAX_OCCUPANCY, Number(body.capacity) || MAX_OCCUPANCY));
      const pricingMode = body.pricing_mode === "split" ? "split" : "fixed";
      const price = Math.max(0, Math.round(Number(body.price_paise ?? 35000)));
      const courtFee = Math.max(0, Math.round(Number(body.court_fee_paise ?? 0)));
      type PlanRow = { venue_id: string; courts: number[]; times: Array<{ start: string; end: string }> };
      const plan = (body.plan as PlanRow[]).filter((p) => p && typeof p.venue_id === "string");
      if (plan.length === 0) return badRequest("Add at least one venue to the plan.");
      for (const p of plan) {
        if (!Array.isArray(p.courts) || p.courts.length === 0) return badRequest("Pick at least one court for every venue.");
        if (p.courts.some((c) => !Number.isInteger(Number(c)) || Number(c) < 1 || Number(c) > 50)) return badRequest("Court numbers must be 1–50.");
        if (!Array.isArray(p.times) || p.times.length === 0) return badRequest("Add at least one time for every venue.");
        for (const t of p.times) {
          if (!TIME.test(t.start) || !TIME.test(t.end) || t.end <= t.start) return badRequest(`Check the time ${t.start}–${t.end}: end must be after start.`);
        }
      }
      let created = 0;
      let skipped = 0;
      for (const date of dates) {
        for (const p of plan) {
          for (const t of p.times) {
            for (const court of [...new Set(p.courts.map(Number))]) {
              const rows = await query<{ id: string }>(
                `INSERT INTO game_sessions (venue_id, session_date, start_time, end_time, court_number,
                   level, mixed_doubles, capacity, price_paise, pricing_mode, court_fee_paise, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open')
                 ON CONFLICT (venue_id, session_date, start_time, court_number) DO NOTHING
                 RETURNING id`,
                [p.venue_id, date, t.start, t.end, court, level, mixed, capacity, price, pricingMode, courtFee],
              );
              if (rows.length) created++;
              else skipped++;
            }
          }
        }
      }
      await audit(gate, "session.plan", "game_sessions", undefined, { created, skipped, dates: dates.length, venues: plan.length, level, mixed });
      return NextResponse.json({
        ok: true,
        created,
        skipped,
        message: skipped ? `${created} slot${created === 1 ? "" : "s"} added. ${skipped} already existed and ${skipped === 1 ? "was" : "were"} left as is.` : undefined,
      });
    }

    const venueIds: string[] = Array.isArray(body.venue_ids)
      ? (body.venue_ids as string[])
      : body.venue_id
        ? [body.venue_id as string]
        : [];
    if (venueIds.length === 0) return badRequest("Pick at least one venue.");

    const level = (body.level as string) ?? "all";
    const capacity = Math.max(1, Math.min(MAX_OCCUPANCY, Number(body.capacity) || MAX_OCCUPANCY));
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
    await ensureSchema();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing session id.");
    if ("capacity" in body) body.capacity = Math.max(1, Math.min(MAX_OCCUPANCY, Number(body.capacity) || MAX_OCCUPANCY));
    if ("court_number" in body) {
      const c = Number(body.court_number);
      if (!Number.isInteger(c) || c < 1 || c > 50) return badRequest("Court number must be between 1 and 50.");
    }
    if ("level" in body && !["all", "beginner", "intermediate", "advanced"].includes(String(body.level))) return badRequest("Unknown level.");
    if ("mixed_doubles" in body) body.mixed_doubles = body.mixed_doubles === true || body.mixed_doubles === "true";
    if ("session_date" in body && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.session_date))) return badRequest("Pick a valid date.");
    for (const k of ["start_time", "end_time"]) {
      if (k in body && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body[k]))) return badRequest("Times must be HH:MM.");
    }
    if ("start_time" in body && "end_time" in body && String(body.end_time) <= String(body.start_time)) return badRequest("The end time must be after the start time.");
    if ("venue_id" in body) {
      const v = await query<{ id: string }>(`SELECT id FROM venues WHERE id = $1`, [body.venue_id]);
      if (v.length === 0) return badRequest("That venue no longer exists.");
    }
    const before = await slotWhere(String(body.id));
    const update = buildUpdate("game_sessions", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    let rows;
    try {
      rows = await query(update.text, update.params);
    } catch (err) {
      if ((err as { code?: string })?.code === "23505") return badRequest("That venue already has a slot on this court at this date and time.");
      throw err;
    }
    await audit(gate, "session.update", "game_sessions", String(body.id), body);

    // Venue, date, time or court moved: tell everyone booked or waiting.
    const after = await slotWhere(String(body.id));
    let notified = 0;
    if (before && after && (["venue_id", "session_date", "start_time", "end_time", "court_number"] as const).some((k) => String(before[k]) !== String(after[k]))) {
      const people = await query<{ id: string; user_id: string | null; player_phone: string | null }>(
        `SELECT id, user_id, player_phone FROM game_registrations WHERE session_id = $1 AND status IN ('confirmed','pending_approval','waitlist')`,
        [body.id],
      );
      const msg = `Your slot has changed. Now: ${describe(after)} (was ${describe(before)}).`;
      for (const p of people) {
        if (p.user_id) await createNotification({ userId: p.user_id, kind: "system", title: "Slot details changed", message: msg, linkUrl: "/dashboard" }).catch(() => {});
        if (p.player_phone) await sendWhatsApp({ kind: "slot_changed", target: "number", phone: `91${p.player_phone}`, message: `🎾 Sparvic — ${msg}`, refTable: "game_registrations", refId: p.id }).catch(() => {});
        // Per-player court overrides follow the slot's new court.
        if (before.court_number !== after.court_number || before.venue_id !== after.venue_id) {
          await query(`UPDATE game_registrations SET court_number = $1 WHERE id = $2`, [after.court_number, p.id]);
        }
      }
      notified = people.length;
    }

    // More room, or rules loosened: let the waitlist move up.
    const promoted = await promoteWaitlist(String(body.id)).catch(() => 0);
    return NextResponse.json({
      ok: true,
      session: rows[0] ?? null,
      message:
        [
          notified ? `${notified} player${notified > 1 ? "s" : ""} told about the change.` : "",
          promoted ? `${promoted} moved up from the waitlist.` : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined,
    });
  } catch (err) {
    return serverError("sessions:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
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
