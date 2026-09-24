import { query, queryOne } from "@/lib/db";

/**
 * Everything a coach dashboard reads, always scoped to a coach_id taken from
 * the coach's own session — never from the request — so a coach can only ever
 * see their own bookings and the players who booked them.
 */

export type CoachBooking = {
  id: string;
  booking_no: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  session_type: "single" | "pair" | "group";
  sessions_count: number;
  preferred_date: string | null;
  preferred_time: string | null;
  amount_paise: number;
  payment_status: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
  // The player, as they gave their details at booking.
  player_name: string;
  player_phone: string;
  player_email: string | null;
  skill_level: string;
  // Their account, when they booked signed in.
  user_id: string | null;
  handle: string | null;
  avatar_url: string | null;
  dupr: number | null;
};

const BOOKING_COLUMNS = `
  b.id, b.booking_no, b.status, b.session_type, b.sessions_count,
  b.preferred_date::text AS preferred_date, b.preferred_time,
  b.amount_paise, b.payment_status, b.payment_method, b.notes, b.created_at::text AS created_at,
  b.player_name, b.player_phone, b.player_email,
  COALESCE(u.skill_level, b.skill_level) AS skill_level,
  b.user_id, u.handle, u.avatar_url, u.dupr`;

/** Bookings dated inside [from, to], plus every undated request still open. */
export async function coachBookings(coachId: string, from: string, to: string): Promise<CoachBooking[]> {
  return query<CoachBooking>(
    `SELECT ${BOOKING_COLUMNS}
     FROM coaching_bookings b
     LEFT JOIN users u ON u.id = b.user_id
     WHERE b.coach_id = $1
       AND ( (b.preferred_date BETWEEN $2::date AND $3::date)
          OR (b.preferred_date IS NULL AND b.status IN ('requested','confirmed')) )
     ORDER BY b.preferred_date NULLS LAST, b.preferred_time NULLS LAST, b.created_at`,
    [coachId, from, to],
  );
}

export type CoachSummary = {
  name: string;
  slug: string;
  image_url: string | null;
  headline: string | null;
  upcoming: number;
  this_week: number;
  awaiting: number;
  clients: number;
  completed: number;
};

/** Headline numbers for the dashboard, in one round trip. */
export async function coachSummary(coachId: string): Promise<CoachSummary | null> {
  return queryOne<CoachSummary>(
    `SELECT c.name, c.slug, c.image_url, c.headline,
       (SELECT COUNT(*) FROM coaching_bookings b WHERE b.coach_id = c.id
          AND b.status IN ('requested','confirmed')
          AND (b.preferred_date IS NULL OR b.preferred_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date))::int AS upcoming,
       (SELECT COUNT(*) FROM coaching_bookings b WHERE b.coach_id = c.id AND b.status <> 'cancelled'
          AND b.preferred_date BETWEEN (now() AT TIME ZONE 'Asia/Kolkata')::date
                                   AND (now() AT TIME ZONE 'Asia/Kolkata')::date + 6)::int AS this_week,
       (SELECT COUNT(*) FROM coaching_bookings b WHERE b.coach_id = c.id AND b.status = 'requested')::int AS awaiting,
       (SELECT COUNT(DISTINCT COALESCE(b.user_id::text, b.player_phone)) FROM coaching_bookings b
          WHERE b.coach_id = c.id AND b.status <> 'cancelled')::int AS clients,
       (SELECT COUNT(*) FROM coaching_bookings b WHERE b.coach_id = c.id AND b.status = 'completed')::int AS completed
     FROM coaches c WHERE c.id = $1`,
    [coachId],
  );
}

export type ClientProfile = {
  id: string;
  full_name: string;
  handle: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  bio: string | null;
  skill_level: string;
  dupr: number | null;
  dupr_id: string | null;
  created_at: string;
  games_played: number;
  assessment: {
    suggested_level: string;
    score: number;
    goal: string | null;
    coach_notes: string | null;
    status: string;
    created_at: string;
  } | null;
  history: Array<{
    booking_no: string;
    status: string;
    preferred_date: string | null;
    preferred_time: string | null;
    session_type: string;
    sessions_count: number;
  }>;
};

/**
 * A player's profile as their coach sees it. Returns null unless this player
 * has booked THIS coach at least once: a coach account is not a way to look up
 * arbitrary members.
 */
export async function clientForCoach(coachId: string, userId: string): Promise<ClientProfile | null> {
  const related = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM coaching_bookings WHERE coach_id = $1 AND user_id = $2) AS ok`,
    [coachId, userId],
  );
  if (!related?.ok) return null;

  const profile = await queryOne<Omit<ClientProfile, "assessment" | "history">>(
    `SELECT u.id, u.full_name, u.handle, u.avatar_url, u.email, u.phone, u.city, u.bio,
            u.skill_level, u.dupr, u.dupr_id, u.created_at::text AS created_at,
            (SELECT COUNT(*) FROM game_registrations g WHERE g.user_id = u.id AND g.status = 'confirmed')::int AS games_played
     FROM users u WHERE u.id = $1`,
    [userId],
  );
  if (!profile) return null;

  const [assessment, history] = await Promise.all([
    queryOne<NonNullable<ClientProfile["assessment"]>>(
      `SELECT suggested_level, score, goal, coach_notes, status, created_at::text AS created_at
       FROM player_assessments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ).catch(() => null),
    query<ClientProfile["history"][number]>(
      `SELECT booking_no, status, preferred_date::text AS preferred_date, preferred_time, session_type, sessions_count
       FROM coaching_bookings WHERE coach_id = $1 AND user_id = $2
       ORDER BY preferred_date DESC NULLS FIRST, created_at DESC LIMIT 20`,
      [coachId, userId],
    ),
  ]);

  return { ...profile, assessment, history };
}
