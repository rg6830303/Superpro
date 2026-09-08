import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, buildUpdate, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { istToday } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["status", "payment_status", "court_number", "players_count", "notes"] as const;

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const params = new URL(req.url).searchParams;
    const sessionId = params.get("session_id");
    const date = params.get("date") ?? (sessionId ? null : istToday());

    const registrations = await query(
      `SELECT r.*, s.session_date, s.start_time, s.end_time, s.court_number AS session_court,
              v.name AS venue_name
       FROM game_registrations r
       JOIN game_sessions s ON s.id = r.session_id
       JOIN venues v ON v.id = s.venue_id
       WHERE ($1::uuid IS NULL OR r.session_id = $1)
         AND ($2::date IS NULL OR s.session_date = $2)
       ORDER BY s.session_date, s.start_time, r.created_at`,
      [sessionId, date],
    );
    return NextResponse.json({ registrations });
  } catch (err) {
    return serverError("registrations:list", err);
  }
}

/** Add a walk-in player straight onto a slot from the console. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.session_id || !body.player_name || !body.player_phone) {
      return badRequest("Session, name and phone are required.");
    }

    const session = await query<{ price_paise: number; court_number: number; capacity: number; booked: number }>(
      `SELECT s.price_paise, s.court_number, s.capacity,
              COALESCE((SELECT SUM(players_count) FROM game_registrations r
                        WHERE r.session_id = s.id AND r.status <> 'cancelled'), 0)::int AS booked
       FROM game_sessions s WHERE s.id = $1`,
      [body.session_id],
    );
    if (session.length === 0) return badRequest("That slot no longer exists.");

    const count = Number(body.players_count ?? 1);
    const s = session[0];

    await query(
      `INSERT INTO game_registrations (session_id, player_name, player_phone, player_email, skill_level,
         players_count, court_number, amount_paise, payment_method, payment_status, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'venue',$9,'confirmed',$10)
       ON CONFLICT (session_id, player_phone) DO UPDATE
         SET players_count = EXCLUDED.players_count, status = 'confirmed'`,
      [
        body.session_id,
        body.player_name,
        String(body.player_phone).replace(/\D/g, ""),
        body.player_email ?? null,
        body.skill_level ?? "beginner",
        count,
        body.court_number ?? s.court_number,
        s.price_paise * count,
        body.payment_status ?? "paid",
        body.notes ?? "Walk-in added by admin",
      ],
    );

    await audit(gate, "registration.walkin", "game_registrations", String(body.session_id), {
      player: body.player_name,
    });
    return NextResponse.json({ ok: true, over_capacity: s.booked + count > s.capacity });
  } catch (err) {
    return serverError("registrations:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.id) return badRequest("Missing registration id.");
    const update = buildUpdate("game_registrations", EDITABLE, body);
    if (!update) return badRequest("Nothing to update.");
    const rows = await query(update.text, update.params);
    await audit(gate, "registration.update", "game_registrations", String(body.id), body);
    return NextResponse.json({ ok: true, registration: rows[0] ?? null });
  } catch (err) {
    return serverError("registrations:update", err);
  }
}
