import { query, queryOne } from "@/lib/db";
import { formatDate, formatTimeRange } from "@/lib/dates";
import { sendWhatsApp, slotConfirmationMessage } from "@/lib/whatsapp";

/**
 * Build and send the daily-games group post for one slot: date, time, venue,
 * court number, and every confirmed player's name.
 *
 * Called automatically when a slot's bookings are confirmed, and manually from
 * the admin console ("Post to group") after a court change or a late addition.
 */
export async function postSlotToGroup(sessionId: string): Promise<{ ok: boolean; message: string }> {
  const session = await queryOne<{
    session_date: string;
    start_time: string;
    end_time: string;
    court_number: number;
    venue_name: string;
  }>(
    `SELECT s.session_date::text AS session_date, s.start_time, s.end_time, s.court_number, v.name AS venue_name
     FROM game_sessions s JOIN venues v ON v.id = s.venue_id WHERE s.id = $1`,
    [sessionId],
  );
  if (!session) return { ok: false, message: "Session not found" };

  const players = await query<{ player_name: string; skill_level: string; players_count: number; court_number: number | null }>(
    `SELECT player_name, skill_level, players_count, court_number
     FROM game_registrations
     WHERE session_id = $1 AND status = 'confirmed'
     ORDER BY created_at`,
    [sessionId],
  );

  // A registration for 3 people shows as "Name (+2)" rather than three rows.
  const roster = players.map((p) => ({
    name: p.players_count > 1 ? `${p.player_name} (+${p.players_count - 1})` : p.player_name,
    level: p.skill_level,
  }));

  const court = players.find((p) => p.court_number != null)?.court_number ?? session.court_number;

  const message = slotConfirmationMessage({
    date: formatDate(session.session_date),
    time: formatTimeRange(session.start_time, session.end_time),
    venue: session.venue_name,
    court,
    players: roster,
  });

  const result = await sendWhatsApp({
    kind: "slot_confirmation",
    target: "group",
    message,
    refTable: "game_sessions",
    refId: sessionId,
  });

  if (result.status === "sent") {
    await query(`UPDATE game_sessions SET whatsapp_posted_at = now() WHERE id = $1`, [sessionId]).catch(() => {});
  }

  return { ok: result.status !== "failed", message };
}
