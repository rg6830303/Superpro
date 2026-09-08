import { query, isDbConfigured } from "@/lib/db";

/**
 * Single source of truth for the SuperPro database schema.
 *
 * Used by:
 *   - POST /api/db-init → explicit bootstrap + seed (run once after deploy)
 *   - ensureSchema()    → lazy auto-heal called from write routes, so a fresh
 *                         Supabase project never silently drops a signup.
 *
 * Money is stored in PAISE as integers everywhere. Never use floats for money.
 * Tables run first, then column migrations, then indexes — an index on a column
 * a legacy table is missing would otherwise abort the whole bootstrap.
 */

export const SCHEMA_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    skill_level TEXT NOT NULL DEFAULT 'beginner'
      CHECK (skill_level IN ('beginner','intermediate','advanced','pro')),
    dupr NUMERIC(3,2),
    city TEXT DEFAULT 'Kolkata',
    avatar_url TEXT,
    whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'SuperPro Admin',
    role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('owner','manager','staff')),
    active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── Shop ──────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('paddles','balls','grips','accessories')),
    tagline TEXT,
    description TEXT,
    specs JSONB NOT NULL DEFAULT '[]'::jsonb,
    price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
    compare_at_paise INTEGER,
    image_url TEXT,
    gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
    stock INTEGER NOT NULL DEFAULT 0,
    featured BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal_paise INTEGER NOT NULL DEFAULT 0,
    shipping_paise INTEGER NOT NULL DEFAULT 0,
    discount_paise INTEGER NOT NULL DEFAULT 0,
    total_paise INTEGER NOT NULL DEFAULT 0,
    delivery_mode TEXT NOT NULL DEFAULT 'pickup' CHECK (delivery_mode IN ('pickup','delivery')),
    address JSONB,
    payment_method TEXT NOT NULL DEFAULT 'razorpay'
      CHECK (payment_method IN ('razorpay','cod','venue')),
    payment_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (payment_status IN ('pending','paid','failed','refunded')),
    fulfillment_status TEXT NOT NULL DEFAULT 'new'
      CHECK (fulfillment_status IN ('new','packed','shipped','delivered','cancelled')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── Daily games ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    area TEXT,
    address TEXT,
    courts INTEGER NOT NULL DEFAULT 2,
    maps_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    court_number INTEGER NOT NULL DEFAULT 1,
    level TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('all','beginner','intermediate','advanced')),
    capacity INTEGER NOT NULL DEFAULT 8,
    price_paise INTEGER NOT NULL DEFAULT 35000,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
    notes TEXT,
    whatsapp_posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (venue_id, session_date, start_time, court_number)
  )`,

  `CREATE TABLE IF NOT EXISTS game_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT,
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    player_name TEXT NOT NULL,
    player_phone TEXT NOT NULL,
    player_email TEXT,
    skill_level TEXT NOT NULL DEFAULT 'beginner'
      CHECK (skill_level IN ('beginner','intermediate','advanced','pro')),
    players_count INTEGER NOT NULL DEFAULT 1 CHECK (players_count BETWEEN 1 AND 4),
    court_number INTEGER,
    amount_paise INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'razorpay'
      CHECK (payment_method IN ('razorpay','cod','venue')),
    payment_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (payment_status IN ('pending','paid','failed','refunded')),
    status TEXT NOT NULL DEFAULT 'confirmed'
      CHECK (status IN ('confirmed','waitlist','cancelled')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, player_phone)
  )`,

  // ── Coaching ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    headline TEXT,
    bio TEXT,
    specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
    dupr NUMERIC(3,2),
    experience_years INTEGER NOT NULL DEFAULT 1,
    rate_paise INTEGER NOT NULL DEFAULT 120000,
    languages TEXT DEFAULT 'English, Hindi, Bengali',
    image_url TEXT,
    whatsapp TEXT,
    available_days JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS coaching_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_no TEXT UNIQUE NOT NULL,
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    player_name TEXT NOT NULL,
    player_phone TEXT NOT NULL,
    player_email TEXT,
    skill_level TEXT NOT NULL DEFAULT 'beginner'
      CHECK (skill_level IN ('beginner','intermediate','advanced','pro')),
    session_type TEXT NOT NULL DEFAULT 'single'
      CHECK (session_type IN ('single','pair','group')),
    sessions_count INTEGER NOT NULL DEFAULT 1 CHECK (sessions_count BETWEEN 1 AND 20),
    preferred_date DATE,
    preferred_time TEXT,
    amount_paise INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'razorpay'
      CHECK (payment_method IN ('razorpay','cod','venue')),
    payment_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (payment_status IN ('pending','paid','failed','refunded')),
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK (status IN ('requested','confirmed','completed','cancelled')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── Tournaments ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'organized' CHECK (kind IN ('organized','sponsored')),
    status TEXT NOT NULL DEFAULT 'announced'
      CHECK (status IN ('announced','open','closed','completed','cancelled')),
    start_date DATE,
    end_date DATE,
    venue TEXT,
    city TEXT NOT NULL DEFAULT 'Kolkata',
    format TEXT,
    categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    prize_pool_paise INTEGER NOT NULL DEFAULT 0,
    entry_fee_paise INTEGER NOT NULL DEFAULT 0,
    max_teams INTEGER NOT NULL DEFAULT 16,
    dupr_cap NUMERIC(4,2),
    banner_url TEXT,
    summary TEXT,
    description TEXT,
    result_note TEXT,
    registration_open BOOLEAN NOT NULL DEFAULT false,
    partner_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS tournament_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    court_number INTEGER,
    scheduled_at TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    group_id UUID REFERENCES tournament_groups(id) ON DELETE SET NULL,
    team_name TEXT NOT NULL,
    category TEXT,
    player1_name TEXT NOT NULL,
    player1_phone TEXT NOT NULL,
    player1_dupr NUMERIC(3,2),
    player2_name TEXT,
    player2_phone TEXT,
    player2_dupr NUMERIC(3,2),
    email TEXT,
    seed INTEGER,
    amount_paise INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'razorpay'
      CHECK (payment_method IN ('razorpay','cod','venue')),
    payment_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (payment_status IN ('pending','paid','failed','refunded')),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','confirmed','waitlist','withdrawn')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── Comms / ops ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'info' CHECK (kind IN ('info','tournament','offer','urgent')),
    link_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS whatsapp_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL DEFAULT 'slot_confirmation',
    target TEXT NOT NULL DEFAULT 'group' CHECK (target IN ('group','number')),
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
    channel TEXT,
    error TEXT,
    ref_table TEXT,
    ref_id UUID,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start BIGINT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta_paise INTEGER NOT NULL,
    balance_after_paise INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'adjustment'
      CHECK (kind IN ('topup','refund','adjustment','booking','order','coaching','tournament','bonus')),
    reason TEXT,
    ref_table TEXT,
    ref_id UUID,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

/** Additive migrations for databases created by an earlier version. */
export const SCHEMA_MIGRATIONS: string[] = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS whatsapp_posted_at TIMESTAMPTZ`,
  `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS partner_name TEXT`,
  `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS seed INTEGER`,
  `ALTER TABLE game_registrations ADD COLUMN IF NOT EXISTS reference TEXT`,
  `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS reference TEXT`,

  // Supabase Auth owns passwords from here on: `users` mirrors auth.users with
  // the app-level profile, so password_hash is legacy and must be nullable.
  `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'supabase'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance_paise INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS dupr_id TEXT`,
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
  `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player','staff','admin'))`,
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wallet_non_negative`,
  `ALTER TABLE users ADD CONSTRAINT users_wallet_non_negative CHECK (wallet_balance_paise >= 0)`,

  // Wallet becomes a payment method everywhere money is taken. The CHECK
  // constraints were created with Postgres' default naming, so they can be
  // dropped and re-added by that name.
  `ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check`,
  `ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
     CHECK (payment_method IN ('razorpay','cod','venue','wallet'))`,
  `ALTER TABLE game_registrations DROP CONSTRAINT IF EXISTS game_registrations_payment_method_check`,
  `ALTER TABLE game_registrations ADD CONSTRAINT game_registrations_payment_method_check
     CHECK (payment_method IN ('razorpay','cod','venue','wallet'))`,
  `ALTER TABLE coaching_bookings DROP CONSTRAINT IF EXISTS coaching_bookings_payment_method_check`,
  `ALTER TABLE coaching_bookings ADD CONSTRAINT coaching_bookings_payment_method_check
     CHECK (payment_method IN ('razorpay','cod','venue','wallet'))`,
  `ALTER TABLE tournament_registrations DROP CONSTRAINT IF EXISTS tournament_registrations_payment_method_check`,
  `ALTER TABLE tournament_registrations ADD CONSTRAINT tournament_registrations_payment_method_check
     CHECK (payment_method IN ('razorpay','cod','venue','wallet'))`,
];

export const SCHEMA_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE active`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_date ON game_sessions(session_date)`,
  `CREATE INDEX IF NOT EXISTS idx_regs_session ON game_registrations(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_regs_phone ON game_registrations(player_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_regs_reference ON game_registrations(reference)`,
  `CREATE INDEX IF NOT EXISTS idx_tourn_reg_reference ON tournament_registrations(reference)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_coach ON coaching_bookings(coach_id)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_created ON coaching_bookings(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tourn_reg_tournament ON tournament_registrations(tournament_id)`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_status ON whatsapp_outbox(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
];

let ensured = false;

/**
 * Idempotent bootstrap. Runs at most once per warm instance; safe to call from
 * any route. Failures are logged and swallowed so a transient DB hiccup never
 * turns into a 500 on a page that could still render.
 */
export async function ensureSchema(force = false): Promise<void> {
  if (!isDbConfigured) return;
  if (ensured && !force) return;
  ensured = true;
  const groups: Array<[string, string[]]> = [
    ["table", SCHEMA_TABLES],
    ["migration", SCHEMA_MIGRATIONS],
    ["index", SCHEMA_INDEXES],
  ];
  for (const [label, statements] of groups) {
    for (const stmt of statements) {
      try {
        await query(stmt);
      } catch (err) {
        console.error(`[schema] ${label} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }
}

/** Full DDL as one script — what supabase/schema.sql contains. */
export function schemaSql(): string {
  return [
    "-- SuperPro — generated from lib/schema.ts. Do not edit by hand.",
    "-- Run this in the Supabase SQL editor, or POST /api/db-init once deployed.",
    "",
    ...[...SCHEMA_TABLES, ...SCHEMA_MIGRATIONS, ...SCHEMA_INDEXES].map((s) => `${s.trim()};`),
    "",
  ].join("\n\n");
}
