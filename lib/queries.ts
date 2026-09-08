import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { istToday, addDays } from "@/lib/dates";
import type { Coach, GameSession, Product, Tournament, Venue } from "@/lib/types";

/**
 * Read helpers used by server components.
 *
 * Every function is defensive: if the database is unreachable or not yet
 * provisioned it logs and returns an empty result rather than throwing, so the
 * site degrades to "nothing scheduled yet" instead of a 500. Pages that use
 * these opt into `force-dynamic` so a Vercel build never needs the database.
 */

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    await ensureSchema();
    return await fn();
  } catch (err) {
    console.error(`[queries:${label}]`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

// ── Shop ────────────────────────────────────────────────────────────────────

export async function getProducts(category?: string): Promise<Product[]> {
  return safe(
    "getProducts",
    async () =>
      query<Product>(
        `SELECT * FROM products
         WHERE active AND ($1::text IS NULL OR category = $1)
         ORDER BY sort_order, created_at`,
        [category ?? null],
      ),
    [],
  );
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  return safe(
    "getFeaturedProducts",
    async () =>
      query<Product>(
        `SELECT * FROM products WHERE active AND featured ORDER BY sort_order LIMIT $1`,
        [limit],
      ),
    [],
  );
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return safe(
    "getProductBySlug",
    async () => {
      const rows = await query<Product>(`SELECT * FROM products WHERE slug = $1 AND active LIMIT 1`, [slug]);
      return rows[0] ?? null;
    },
    null,
  );
}

export async function getRelatedProducts(category: string, excludeSlug: string, limit = 3): Promise<Product[]> {
  return safe(
    "getRelatedProducts",
    async () =>
      query<Product>(
        `SELECT * FROM products WHERE active AND category = $1 AND slug <> $2 ORDER BY sort_order LIMIT $3`,
        [category, excludeSlug, limit],
      ),
    [],
  );
}

// ── Daily games ─────────────────────────────────────────────────────────────

export async function getVenues(): Promise<Venue[]> {
  return safe(
    "getVenues",
    async () => query<Venue>(`SELECT * FROM venues WHERE active ORDER BY sort_order, name`),
    [],
  );
}

/**
 * Every open session for the coming `days` days, with a live booked count so
 * the picker can show "3 spots left" without a second round trip.
 */
export async function getWeekSessions(days = 7): Promise<GameSession[]> {
  const from = istToday();
  const to = addDays(from, days - 1);
  return safe(
    "getWeekSessions",
    async () =>
      query<GameSession>(
        `SELECT s.*, v.name AS venue_name, v.area AS venue_area,
                COALESCE(r.booked, 0)::int AS booked
         FROM game_sessions s
         JOIN venues v ON v.id = s.venue_id
         LEFT JOIN (
           SELECT session_id, SUM(players_count) AS booked
           FROM game_registrations
           WHERE status <> 'cancelled'
           GROUP BY session_id
         ) r ON r.session_id = s.id
         WHERE s.session_date BETWEEN $1 AND $2 AND s.status = 'open' AND v.active
         ORDER BY s.session_date, s.start_time, v.sort_order, s.court_number`,
        [from, to],
      ),
    [],
  );
}

export async function getSessionsByIds(ids: string[]): Promise<GameSession[]> {
  if (ids.length === 0) return [];
  return safe(
    "getSessionsByIds",
    async () =>
      query<GameSession>(
        `SELECT s.*, v.name AS venue_name, v.area AS venue_area,
                COALESCE(r.booked, 0)::int AS booked
         FROM game_sessions s
         JOIN venues v ON v.id = s.venue_id
         LEFT JOIN (
           SELECT session_id, SUM(players_count) AS booked
           FROM game_registrations WHERE status <> 'cancelled' GROUP BY session_id
         ) r ON r.session_id = s.id
         WHERE s.id = ANY($1::uuid[])
         ORDER BY s.session_date, s.start_time`,
        [ids],
      ),
    [],
  );
}

// ── Coaching ────────────────────────────────────────────────────────────────

export async function getCoaches(): Promise<Coach[]> {
  return safe(
    "getCoaches",
    async () => query<Coach>(`SELECT * FROM coaches WHERE active ORDER BY sort_order, name`),
    [],
  );
}

export async function getCoachBySlug(slug: string): Promise<Coach | null> {
  return safe(
    "getCoachBySlug",
    async () => {
      const rows = await query<Coach>(`SELECT * FROM coaches WHERE slug = $1 AND active LIMIT 1`, [slug]);
      return rows[0] ?? null;
    },
    null,
  );
}

// ── Tournaments ─────────────────────────────────────────────────────────────

export async function getTournaments(): Promise<Tournament[]> {
  return safe(
    "getTournaments",
    async () =>
      query<Tournament>(
        `SELECT t.*, COALESCE(r.teams, 0)::int AS teams
         FROM tournaments t
         LEFT JOIN (
           SELECT tournament_id, COUNT(*) AS teams
           FROM tournament_registrations WHERE status <> 'withdrawn' GROUP BY tournament_id
         ) r ON r.tournament_id = t.id
         WHERE t.status <> 'cancelled'
         ORDER BY
           CASE t.status WHEN 'open' THEN 0 WHEN 'announced' THEN 1 WHEN 'closed' THEN 2 ELSE 3 END,
           t.start_date DESC NULLS LAST`,
      ),
    [],
  );
}

export async function getTournamentBySlug(slug: string): Promise<Tournament | null> {
  return safe(
    "getTournamentBySlug",
    async () => {
      const rows = await query<Tournament>(
        `SELECT t.*, COALESCE(r.teams, 0)::int AS teams
         FROM tournaments t
         LEFT JOIN (
           SELECT tournament_id, COUNT(*) AS teams
           FROM tournament_registrations WHERE status <> 'withdrawn' GROUP BY tournament_id
         ) r ON r.tournament_id = t.id
         WHERE t.slug = $1 LIMIT 1`,
        [slug],
      );
      return rows[0] ?? null;
    },
    null,
  );
}

export type PublicGroup = { id: string; name: string; court_number: number | null; teams: string[] };

/** Published draw for a tournament — shown once the admin has grouped teams. */
export async function getTournamentGroups(tournamentId: string): Promise<PublicGroup[]> {
  return safe(
    "getTournamentGroups",
    async () => {
      const rows = await query<{ id: string; name: string; court_number: number | null; team_name: string | null }>(
        `SELECT g.id, g.name, g.court_number, r.team_name
         FROM tournament_groups g
         LEFT JOIN tournament_registrations r ON r.group_id = g.id AND r.status <> 'withdrawn'
         WHERE g.tournament_id = $1
         ORDER BY g.name, r.seed NULLS LAST, r.team_name`,
        [tournamentId],
      );
      const map = new Map<string, PublicGroup>();
      for (const row of rows) {
        if (!map.has(row.id)) map.set(row.id, { id: row.id, name: row.name, court_number: row.court_number, teams: [] });
        if (row.team_name) map.get(row.id)!.teams.push(row.team_name);
      }
      return [...map.values()];
    },
    [],
  );
}

// ── Announcements ───────────────────────────────────────────────────────────

export type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: "info" | "tournament" | "offer" | "urgent";
  link_url: string | null;
};

export async function getAnnouncements(limit = 3): Promise<Announcement[]> {
  return safe(
    "getAnnouncements",
    async () =>
      query<Announcement>(
        `SELECT id, title, body, kind, link_url FROM announcements
         WHERE active
           AND (starts_at IS NULL OR starts_at <= now())
           AND (ends_at IS NULL OR ends_at >= now())
         ORDER BY created_at DESC LIMIT $1`,
        [limit],
      ),
    [],
  );
}
