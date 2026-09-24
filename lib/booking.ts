import { query } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { perPlayerPaise } from "@/lib/money";
import { needsApproval } from "@/lib/levels";
import { notifyFollowers } from "@/lib/notifications";

/**
 * Slot booking, shared by the cart checkout and the direct games endpoint.
 *
 * Both paths have to agree on what a slot costs, whether it still has room and
 * whether the player is reaching above their band. Two copies of that would
 * drift, and the first sign of the drift would be someone charged the wrong
 * amount for a court.
 */

export type SessionRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  court_number: number;
  capacity: number;
  level: string;
  venue_name: string;
  pricing_mode?: string;
  court_fee_paise?: number;
  price_paise?: number;
  booked: number;
};

/** Load the sessions behind a set of ids, with a live booked count. */
export async function loadSessions(ids: string[]): Promise<SessionRow[]> {
  if (ids.length === 0) return [];
  return query<SessionRow>(
    `SELECT s.id, s.session_date::text AS session_date, s.start_time, s.end_time, s.court_number,
            s.capacity, s.level, s.pricing_mode, s.court_fee_paise, s.price_paise, v.name AS venue_name,
            COALESCE((SELECT SUM(r.players_count) FROM game_registrations r
                      WHERE r.session_id = s.id AND r.status <> 'cancelled'), 0)::int AS booked
     FROM game_sessions s JOIN venues v ON v.id = s.venue_id
     WHERE s.id = ANY($1) AND s.status = 'open'`,
    [ids],
  );
}

/** What one seat at this slot costs, resolved from the slot's own pricing. */
export function slotPricePaise(s: SessionRow): number {
  return perPlayerPaise(s as never);
}

/**
 * Refuse a basket that cannot be honoured. Capacity is re-checked here against
 * a live count rather than trusted from the page, so two people racing for the
 * last place cannot both be confirmed.
 */
export function checkSlots(sessions: SessionRow[], wanted: string[], playersEach = 1): string | null {
  if (sessions.length !== wanted.length) {
    return "One of those slots is no longer available.";
  }
  for (const s of sessions) {
    if (s.capacity - s.booked < playersEach) {
      return `The ${formatDate(s.session_date)} ${s.start_time} slot just filled up. Pick another.`;
    }
  }
  return null;
}

/**
 * Write the registrations.
 *
 * Reaching above your band is a request, not a booking — those rows land as
 * `pending_approval` for an admin to decide. Playing down is always fine, so
 * only the upward direction is gated.
 */
export async function insertRegistrations(args: {
  sessions: SessionRow[];
  reference: string;
  orderRef?: string | null;
  userId: string;
  playerName: string;
  playerPhone: string;
  playerEmail?: string | null;
  skillLevel: string;
  playersCount?: number;
  method: string;
  paymentStatus: string;
  notes?: string | null;
}): Promise<{ gatedCount: number }> {
  const players = args.playersCount ?? 1;
  const gated = new Set(
    args.sessions.filter((s) => needsApproval(s.level, args.skillLevel)).map((s) => s.id),
  );

  for (const s of args.sessions) {
    await query(
      `INSERT INTO game_registrations (reference, order_ref, session_id, user_id, player_name, player_phone,
         player_email, skill_level, players_count, court_number, amount_paise, payment_method,
         payment_status, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (session_id, user_id) WHERE user_id IS NOT NULL DO UPDATE
         SET players_count = EXCLUDED.players_count,
             status = EXCLUDED.status,
             reference = EXCLUDED.reference,
             order_ref = EXCLUDED.order_ref,
             amount_paise = EXCLUDED.amount_paise,
             payment_method = EXCLUDED.payment_method,
             payment_status = EXCLUDED.payment_status`,
      [
        args.reference,
        args.orderRef ?? null,
        s.id,
        args.userId,
        args.playerName,
        args.playerPhone,
        args.playerEmail || null,
        args.skillLevel,
        players,
        s.court_number,
        slotPricePaise(s) * players,
        args.method,
        args.paymentStatus,
        gated.has(s.id) ? "pending_approval" : "confirmed",
        args.notes ?? null,
      ],
    );
  }

  return { gatedCount: gated.size };
}

/**
 * Tell a player's followers they are on court.
 *
 * Only confirmed seats are announced — a slot waiting on coach approval may
 * never happen, and announcing it would send people to a court the player is
 * not on. Callers invoke this once the booking is real: straight away for
 * pay-at-venue and wallet, and after signature verification for online
 * payments, so an abandoned Razorpay window never tells anyone anything.
 */
export async function announceSlots(reference: string): Promise<void> {
  const rows = await query<{
    user_id: string;
    player_name: string;
    session_date: string;
    start_time: string;
    venue_name: string;
  }>(
    `SELECT r.user_id, COALESCE(u.full_name, r.player_name) AS player_name,
            s.session_date::text AS session_date, s.start_time, v.name AS venue_name
     FROM game_registrations r
     JOIN game_sessions s ON s.id = r.session_id
     JOIN venues v ON v.id = s.venue_id
     LEFT JOIN users u ON u.id = r.user_id
     WHERE (r.reference = $1 OR r.order_ref = $1) AND r.status = 'confirmed' AND r.user_id IS NOT NULL
     ORDER BY s.session_date, s.start_time`,
    [reference],
  );
  if (rows.length === 0) return;

  const first = rows[0];
  const more = rows.length > 1 ? ` (and ${rows.length - 1} more slot${rows.length > 2 ? "s" : ""})` : "";
  await notifyFollowers({
    actorId: first.user_id,
    kind: "game_booking",
    title: `${first.player_name} booked a game`,
    message: `${first.player_name} is playing at ${first.venue_name} on ${formatDate(first.session_date)}, ${first.start_time}${more}. Join them on court.`,
    linkUrl: "/games",
  });
}
