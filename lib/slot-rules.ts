import { query, queryOne } from "@/lib/db";
import { formatDate, formatTimeRange } from "@/lib/dates";
import { needsApproval } from "@/lib/levels";
import { createNotification } from "@/lib/notifications";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * Court-slot occupancy rules, in one place so every booking path and the
 * admin console agree:
 *
 *   - A court slot holds at most MAX_OCCUPANCY players, whatever capacity an
 *     admin types.
 *   - A mixed-doubles slot holds at most MIXED_MAX_PER_GENDER of either
 *     gender (so with 5 players, at least 2 are of the other gender). Each
 *     player books their own seat, and their gender comes from their profile.
 *   - A full slot (or a full gender quota) puts the player on the waitlist,
 *     unpaid. When a seat frees up, the earliest waitlisted player who fits is
 *     promoted automatically and told.
 *
 * Seats are confirmed + pending_approval bookings; waitlisted and cancelled
 * ones hold none.
 */
export const MAX_OCCUPANCY = 5;
export const MIXED_MAX_PER_GENDER = 3;

const SEAT_STATUSES = "('confirmed','pending_approval')";

export type SlotGender = "male" | "female";

/** The gender a mixed-doubles quota counts, or null if the profile doesn't say. */
export function slotGender(g: string | null | undefined): SlotGender | null {
  const v = (g ?? "").toLowerCase();
  return v === "male" || v === "female" ? v : null;
}

export const effectiveCapacity = (capacity: number | null | undefined) =>
  Math.max(1, Math.min(MAX_OCCUPANCY, Number(capacity) || MAX_OCCUPANCY));

export type Occupancy = { seats: number; male: number; female: number; waitlist: number };

export async function occupancyOf(sessionIds: string[]): Promise<Map<string, Occupancy>> {
  const map = new Map<string, Occupancy>();
  if (sessionIds.length === 0) return map;
  const rows = await query<{ session_id: string; seats: number; male: number; female: number; waitlist: number }>(
    `SELECT r.session_id,
            COALESCE(SUM(r.players_count) FILTER (WHERE r.status IN ${SEAT_STATUSES}), 0)::int AS seats,
            COALESCE(SUM(r.players_count) FILTER (WHERE r.status IN ${SEAT_STATUSES}
              AND lower(COALESCE(r.player_gender, u.gender)) = 'male'), 0)::int AS male,
            COALESCE(SUM(r.players_count) FILTER (WHERE r.status IN ${SEAT_STATUSES}
              AND lower(COALESCE(r.player_gender, u.gender)) = 'female'), 0)::int AS female,
            COUNT(*) FILTER (WHERE r.status = 'waitlist')::int AS waitlist
     FROM game_registrations r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.session_id = ANY($1::uuid[])
     GROUP BY r.session_id`,
    [sessionIds],
  );
  for (const id of sessionIds) map.set(id, { seats: 0, male: 0, female: 0, waitlist: 0 });
  for (const r of rows) map.set(r.session_id, { seats: r.seats, male: r.male, female: r.female, waitlist: r.waitlist });
  return map;
}

export type SeatSlot = { id: string; capacity: number; mixed_doubles: boolean; level: string };

/**
 * Where a booking of `players` seats lands on this slot: a seat (confirmed, or
 * pending approval when playing above their level), the waitlist, or refused.
 */
export function decideSeat(
  slot: SeatSlot,
  occ: Occupancy,
  player: { gender: SlotGender | null; skill: string; players: number },
): { status: "confirmed" | "pending_approval" | "waitlist" } | { error: string } {
  if (slot.mixed_doubles) {
    if (player.players !== 1) return { error: "Mixed doubles slots are booked one player at a time." };
    if (!player.gender) return { error: "Add your gender (male or female) to your profile to book mixed doubles." };
  }
  const cap = effectiveCapacity(slot.capacity);
  if (player.players > cap) return { error: `A court slot holds at most ${cap} players.` };
  const full = occ.seats + player.players > cap;
  const quotaFull = slot.mixed_doubles && player.gender ? occ[player.gender] + 1 > MIXED_MAX_PER_GENDER : false;
  if (full || quotaFull) return { status: "waitlist" };
  return { status: needsApproval(slot.level, player.skill) ? "pending_approval" : "confirmed" };
}

/** Plain-language reason a slot is waitlisting, for the booking response. */
export function waitlistReason(slot: SeatSlot, occ: Occupancy, gender: SlotGender | null): string {
  if (slot.mixed_doubles && gender && occ[gender] >= MIXED_MAX_PER_GENDER) {
    return `Mixed doubles: the ${gender === "male" ? "men's" : "women's"} spots are full`;
  }
  return "The court is full";
}

/**
 * Fill freed seats from the waitlist, earliest first, respecting capacity and
 * the mixed-doubles quota. Call after anything that frees a seat or loosens
 * the rules (a cancellation, a deletion, a capacity or tag change).
 */
export async function promoteWaitlist(sessionId: string): Promise<number> {
  const slot = await queryOne<SeatSlot & { status: string; session_date: string; start_time: string; end_time: string; court_number: number; venue_name: string }>(
    `SELECT s.id, s.capacity, s.mixed_doubles, s.level, s.status, s.session_date::text AS session_date, s.start_time,
            s.end_time, s.court_number, v.name AS venue_name
     FROM game_sessions s JOIN venues v ON v.id = s.venue_id WHERE s.id = $1`,
    [sessionId],
  );
  if (!slot || slot.status !== "open") return 0;
  const waiting = await query<{ id: string; user_id: string | null; player_name: string; player_phone: string | null; players_count: number; skill_level: string; gender: string | null }>(
    `SELECT r.id, r.user_id, r.player_name, r.player_phone, r.players_count, r.skill_level,
            COALESCE(r.player_gender, u.gender) AS gender
     FROM game_registrations r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.session_id = $1 AND r.status = 'waitlist' ORDER BY r.created_at`,
    [sessionId],
  );
  let promoted = 0;
  for (const w of waiting) {
    const occ = (await occupancyOf([sessionId])).get(sessionId)!;
    const d = decideSeat(slot, occ, { gender: slotGender(w.gender), skill: w.skill_level, players: w.players_count });
    if ("error" in d || d.status === "waitlist") continue;
    const moved = await queryOne<{ id: string }>(
      `UPDATE game_registrations SET status = $2, promoted_at = now() WHERE id = $1 AND status = 'waitlist' RETURNING id`,
      [w.id, d.status],
    );
    if (!moved) continue;
    promoted++;
    const when = `${formatDate(slot.session_date)} · ${formatTimeRange(slot.start_time, slot.end_time)} · ${slot.venue_name} Court ${slot.court_number}`;
    const msg =
      d.status === "confirmed"
        ? `A spot opened up — you're off the waitlist and on court: ${when}. Pay at the venue or from your Sparvic wallet.`
        : `A spot opened up on ${when}. You're off the waitlist; the club will confirm your level shortly.`;
    if (w.user_id) {
      await createNotification({ userId: w.user_id, kind: "system", title: "You're off the waitlist", message: msg, linkUrl: "/dashboard" }).catch(() => {});
    }
    if (w.player_phone) {
      await sendWhatsApp({ kind: "waitlist_promoted", target: "number", phone: `91${w.player_phone}`, message: `🎾 Sparvic — ${msg}`, refTable: "game_registrations", refId: w.id }).catch(() => {});
    }
  }
  return promoted;
}
