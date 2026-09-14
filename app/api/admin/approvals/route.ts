import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { formatDate, formatTime } from "@/lib/dates";
import { postSlotToGroup } from "@/lib/games";
import { LEVEL_LABEL } from "@/lib/levels";
import { sendWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Requests to play above one's band.
 *
 * A player rated below a court's standard can ask in, and an admin decides.
 * Approving confirms the booking and posts the updated roster to the group;
 * declining frees the spot and tells the player why.
 */
export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const requests = await query(
      `SELECT r.id, r.player_name, r.player_phone, r.skill_level, r.players_count, r.amount_paise,
              r.payment_status, r.created_at, r.session_id,
              s.session_date::text AS session_date, s.start_time, s.end_time, s.level AS slot_level,
              s.capacity, v.name AS venue_name,
              COALESCE((SELECT SUM(players_count) FROM game_registrations x
                        WHERE x.session_id = s.id AND x.status = 'confirmed'), 0)::int AS confirmed
       FROM game_registrations r
       JOIN game_sessions s ON s.id = r.session_id
       JOIN venues v ON v.id = s.venue_id
       WHERE r.status = 'pending_approval'
       ORDER BY s.session_date, s.start_time, r.created_at`,
    );
    return NextResponse.json({ requests });
  } catch (err) {
    return serverError("approvals:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id ?? "");
    const action = String(body.action ?? "");
    if (!id) return badRequest("Missing request id.");
    if (action !== "approve" && action !== "decline") return badRequest("Unknown action.");

    const reg = await queryOne<{
      id: string;
      session_id: string;
      player_name: string;
      player_phone: string;
      skill_level: string;
      players_count: number;
      capacity: number;
      confirmed: number;
      slot_level: string;
      session_date: string;
      start_time: string;
      venue_name: string;
    }>(
      `SELECT r.id, r.session_id, r.player_name, r.player_phone, r.skill_level, r.players_count,
              s.capacity, s.level AS slot_level, s.session_date::text AS session_date, s.start_time,
              v.name AS venue_name,
              COALESCE((SELECT SUM(players_count) FROM game_registrations x
                        WHERE x.session_id = s.id AND x.status = 'confirmed'), 0)::int AS confirmed
       FROM game_registrations r
       JOIN game_sessions s ON s.id = r.session_id
       JOIN venues v ON v.id = s.venue_id
       WHERE r.id = $1 LIMIT 1`,
      [id],
    );
    if (!reg) return badRequest("That request no longer exists.");

    if (action === "decline") {
      await query(
        `UPDATE game_registrations SET status = 'declined', approval_note = $1, decided_at = now() WHERE id = $2`,
        [body.note ?? null, id],
      );
      await sendWhatsApp({
        kind: "play_up_declined",
        target: "number",
        phone: `91${reg.player_phone}`,
        message: `Hi ${reg.player_name.split(" ")[0]} — the ${LEVEL_LABEL[reg.slot_level] ?? reg.slot_level} court on ${formatDate(reg.session_date)} at ${formatTime(reg.start_time)} is not a fit this time.${body.note ? ` ${body.note}` : ""} There are open games at your level — book any of them on the site.`,
        refTable: "game_registrations",
        refId: id,
      });
      await audit(gate, "approval.decline", "game_registrations", id, { player: reg.player_name });
      return NextResponse.json({ ok: true, status: "declined" });
    }

    // Approving must not overfill the court — the spot may have gone while the
    // request was waiting.
    if (reg.confirmed + reg.players_count > reg.capacity) {
      return NextResponse.json(
        { error: `That court is now full (${reg.confirmed}/${reg.capacity}). Decline this one or free a spot first.` },
        { status: 409 },
      );
    }

    await query(
      `UPDATE game_registrations SET status = 'confirmed', approval_note = $1, decided_at = now() WHERE id = $2`,
      [body.note ?? null, id],
    );
    await sendWhatsApp({
      kind: "play_up_approved",
      target: "number",
      phone: `91${reg.player_phone}`,
      message: `You're in. ${formatDate(reg.session_date)} at ${formatTime(reg.start_time)}, ${reg.venue_name} — the ${LEVEL_LABEL[reg.slot_level] ?? reg.slot_level} court. Play well.`,
      refTable: "game_registrations",
      refId: id,
    });
    // The roster changed, so the group post is now out of date.
    await postSlotToGroup(reg.session_id).catch((err) =>
      console.error("[approvals] group post failed:", err),
    );

    await audit(gate, "approval.approve", "game_registrations", id, { player: reg.player_name });
    return NextResponse.json({ ok: true, status: "confirmed" });
  } catch (err) {
    return serverError("approvals:decide", err);
  }
}
