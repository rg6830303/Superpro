import { query, isDbConfigured } from "@/lib/db";
import { istToday, addDays } from "@/lib/dates";
import type { Coach, GameSession, Product, Tournament, Venue } from "@/lib/types";

/**
 * Read helpers used by server components.
 *
 * Every function is defensive with a strict 2-second timeout. If the database
 * is unreachable or still cold, it returns default seed/fallback data instantly
 * rather than hanging or throwing a 504/ERR_CONNECTION_ABORTED.
 */

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDbConfigured) return fallback;
  try {
    const queryPromise = fn();
    const timeoutPromise = new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout")), 2000),
    );
    const result = await Promise.race([queryPromise, timeoutPromise]);
    if (Array.isArray(result) && result.length === 0 && Array.isArray(fallback) && fallback.length > 0) {
      return fallback;
    }
    return result;
  } catch (err) {
    console.error(`[queries:${label}]`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

// ── Built-in Fallbacks ──────────────────────────────────────────────────────

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "fb-1",
    slug: "champion-series-t700",
    name: "Champion Series T700",
    category: "paddles",
    tagline: "The flagship. Toray T700 carbon, thermoformed, unforgiving on the other side of the net.",
    description: "Our top paddle: a 16mm thermoformed unibody with a raw Toray T700 carbon-fibre face and a polypropylene honeycomb core.",
    specs: ["16 mm thermoformed unibody", "Raw Toray T700 carbon face", "Polypropylene honeycomb core", "Weight 8.0–8.3 oz"],
    price_paise: 900000,
    compare_at_paise: 1100000,
    image_url: "/products/paddle-champion-t700.png",
    gallery: ["/products/paddle-champion-t700.png", "/products/paddle-ball-hero.png"],
    stock: 24,
    featured: true,
    active: true,
    sort_order: 1,
  },
  {
    id: "fb-2",
    slug: "champion-series-16-pro",
    name: "Champion Series 16 Pro",
    category: "paddles",
    tagline: "All-court control paddle with a plush 16 mm core and a quiet, planted feel.",
    description: "Built for the player who wins with placement. The 16mm core dampens pace so dinks sit down inside the kitchen.",
    specs: ["16 mm polypropylene core", "Textured composite face", "Weight 7.8–8.1 oz"],
    price_paise: 780000,
    compare_at_paise: 890000,
    image_url: "/products/paddle-edge-16mm.png",
    gallery: ["/products/paddle-edge-16mm.png"],
    stock: 36,
    featured: true,
    active: true,
    sort_order: 2,
  },
  {
    id: "fb-3",
    slug: "superpro-outdoor-40-3pack",
    name: "SuperPro Outdoor 40 — 3 pack",
    category: "balls",
    tagline: "40-hole outdoor ball, seam-welded to survive a Kolkata summer.",
    description: "Rotationally moulded with a seam-welded equator so it does not crack open after two humid weeks.",
    specs: ["40 holes · outdoor", "Seam-welded construction", "USAP-spec bounce"],
    price_paise: 90000,
    compare_at_paise: null,
    image_url: "/products/paddle-ball-hero.png",
    gallery: ["/products/paddle-ball-hero.png"],
    stock: 120,
    featured: true,
    active: true,
    sort_order: 3,
  },
  {
    id: "fb-4",
    slug: "superpro-gold-band",
    name: "SuperPro Gold Series Band",
    category: "grips",
    tagline: "Gold-badge wristband — sweat management with the club mark on it.",
    description: "Woven wristband with the SuperPro mark in brushed gold. Wide enough to actually catch sweat before it reaches the grip.",
    specs: ["Woven terry-back band", "Brushed gold badge"],
    price_paise: 70000,
    compare_at_paise: null,
    image_url: "/products/grip-band-gold.png",
    gallery: ["/products/grip-band-gold.png"],
    stock: 80,
    featured: true,
    active: true,
    sort_order: 4,
  },
];

const FALLBACK_COACHES: Coach[] = [
  {
    id: "c-1",
    slug: "arindam-basu",
    name: "Arindam Basu",
    headline: "Head coach · DUPR 5.4 · builds third-shot discipline",
    bio: "Ten years across tennis and pickleball, and the coach most of our tournament players came up under. Arindam rebuilds your third shot first — drop before drive — then hands you the patterns that win the kitchen exchange.",
    specialties: ["Third-shot drop", "Kitchen strategy", "Doubles positioning"],
    dupr: 5.4,
    experience_years: 10,
    rate_paise: 150000,
    languages: "English, Hindi, Bengali",
    image_url: null,
    whatsapp: null,
    available_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    active: true,
    sort_order: 1,
  },
  {
    id: "c-2",
    slug: "riya-mehta",
    name: "Riya Mehta",
    headline: "Beginner specialist · DUPR 4.6 · zero-to-rally in four sessions",
    bio: "Riya coaches first-timers and improvers. Her four-session block takes someone who has never held a paddle to holding their own in an open game.",
    specialties: ["First-timers", "Serve & return", "Women's clinics"],
    dupr: 4.6,
    experience_years: 5,
    rate_paise: 110000,
    languages: "English, Hindi",
    image_url: null,
    whatsapp: null,
    available_days: ["Tue", "Wed", "Thu", "Sat", "Sun"],
    active: true,
    sort_order: 2,
  },
];

const FALLBACK_TOURNAMENTS: Tournament[] = [
  {
    id: "t-1",
    slug: "legends-challengers-3",
    title: "Legends & Challengers — 3rd Edition",
    kind: "organized",
    status: "open",
    start_date: "2026-10-17",
    end_date: "2026-10-18",
    venue: "TurfXL, New Alipore",
    city: "Kolkata",
    format: "Split-age doubles · round robin into knockouts",
    categories: ["Men's Doubles", "Women's Doubles", "Mixed Doubles"],
    prize_pool_paise: 2500000,
    entry_fee_paise: 150000,
    max_teams: 24,
    dupr_cap: 8.7,
    banner_url: null,
    summary: "The third edition of our flagship doubles event. 24 teams, three categories, round-robin groups into a knockout on day two.",
    description: "Legends & Challengers pairs an experienced player with a challenger and rewards the pair that adapts fastest.",
    result_note: null,
    registration_open: true,
    partner_name: null,
    teams: 18,
  },
];

// ── Shop ────────────────────────────────────────────────────────────────────

export async function getProducts(category?: string): Promise<Product[]> {
  const filteredFallback = category
    ? FALLBACK_PRODUCTS.filter((p) => p.category === category)
    : FALLBACK_PRODUCTS;

  return safe(
    "getProducts",
    async () =>
      query<Product>(
        `SELECT * FROM products
         WHERE active AND ($1::text IS NULL OR category = $1)
         ORDER BY sort_order, created_at`,
        [category ?? null],
      ),
    filteredFallback,
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
    FALLBACK_PRODUCTS.filter((p) => p.featured).slice(0, limit),
  );
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const fallback = FALLBACK_PRODUCTS.find((p) => p.slug === slug) ?? null;
  return safe(
    "getProductBySlug",
    async () => {
      const rows = await query<Product>(`SELECT * FROM products WHERE slug = $1 AND active LIMIT 1`, [slug]);
      return rows[0] ?? fallback;
    },
    fallback,
  );
}

export async function getRelatedProducts(category: string, excludeSlug: string, limit = 3): Promise<Product[]> {
  const fallback = FALLBACK_PRODUCTS.filter((p) => p.category === category && p.slug !== excludeSlug).slice(0, limit);
  return safe(
    "getRelatedProducts",
    async () =>
      query<Product>(
        `SELECT * FROM products WHERE active AND category = $1 AND slug <> $2 ORDER BY sort_order LIMIT $3`,
        [category, excludeSlug, limit],
      ),
    fallback,
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
    FALLBACK_COACHES,
  );
}

export async function getCoachBySlug(slug: string): Promise<Coach | null> {
  const fallback = FALLBACK_COACHES.find((c) => c.slug === slug) ?? null;
  return safe(
    "getCoachBySlug",
    async () => {
      const rows = await query<Coach>(`SELECT * FROM coaches WHERE slug = $1 AND active LIMIT 1`, [slug]);
      return rows[0] ?? fallback;
    },
    fallback,
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
    FALLBACK_TOURNAMENTS,
  );
}

export async function getTournamentBySlug(slug: string): Promise<Tournament | null> {
  const fallback = FALLBACK_TOURNAMENTS.find((t) => t.slug === slug) ?? null;
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
      return rows[0] ?? fallback;
    },
    fallback,
  );
}

export type PublicGroup = { id: string; name: string; court_number: number | null; teams: string[] };

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

const FALLBACK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a-1",
    title: "Legends & Challengers 3rd Edition — registration open",
    body: "24 teams, three categories, ₹25,000 prize pool. Registration closes when the draw fills.",
    kind: "tournament",
    link_url: "/tournaments/legends-challengers-3",
  },
];

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
    FALLBACK_ANNOUNCEMENTS.slice(0, limit),
  );
}
