import { getSql, query, isDbConfigured } from "@/lib/db";

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
      CHECK (status IN ('confirmed','waitlist','cancelled','pending_approval','declined')),
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

  `CREATE TABLE IF NOT EXISTS time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (start_time, end_time)
  )`,

  `CREATE TABLE IF NOT EXISTS tournament_form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text'
      CHECK (type IN ('text','textarea','number','select','checkbox','date','email','phone')),
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    required BOOLEAN NOT NULL DEFAULT false,
    help TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tournament_id, field_key)
  )`,

  `CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
  )`,

  `CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('game_booking','tournament_entry','follow','system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id, created_at DESC)`,

  // A coach's login. Deliberately separate from player accounts: a coach sees
  // their clients' contact details, so a coach account can only be created
  // for an email the club has put on that coach's profile (coaches.email).
  // One login per coach.
  `CREATE TABLE IF NOT EXISTS coach_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID UNIQUE NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS coach_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, weekday, start_time)
  )`,

  // Discount codes.
  //
  // `max_uses` is the headline control: a code can be minted for a fixed number
  // of redemptions and stops working the moment they are gone. Redemptions are
  // journalled in their own table rather than only counted, so "who used this
  // and what did it cost us" is answerable after the fact.
  // One cart per account, for everything.
  //
  // The cart used to live only in localStorage, which meant a device-local
  // basket for gear and an entirely separate flow for court slots — two carts
  // wearing one name. This is the single basket: it holds product lines and
  // slot lines side by side, it follows the player between devices, and it is
  // what checkout reads.
  `CREATE TABLE IF NOT EXISTS carts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // Every admin touch on an order, kept as a trail rather than overwriting a
  // single status field. "Who marked this delivered, and when" has to survive
  // the next status change.
  `CREATE TABLE IF NOT EXISTS order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    courier TEXT,
    tracking_ref TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    description TEXT,
    kind TEXT NOT NULL DEFAULT 'percent' CHECK (kind IN ('percent','amount')),
    -- Exactly one of these carries the value, according to kind.
    percent_off NUMERIC(5,2) CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
    amount_off_paise INTEGER CHECK (amount_off_paise IS NULL OR amount_off_paise > 0),
    -- Ceiling on what a percentage code can take off a large basket.
    max_discount_paise INTEGER,
    min_spend_paise INTEGER NOT NULL DEFAULT 0,
    -- NULL means unlimited; a number is a hard stop across all users.
    max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
    used_count INTEGER NOT NULL DEFAULT 0,
    -- NULL means unlimited per person.
    per_user_limit INTEGER DEFAULT 1 CHECK (per_user_limit IS NULL OR per_user_limit > 0),
    -- Which checkouts accept it: shop, games, coaching, tournaments.
    scopes TEXT[] NOT NULL DEFAULT ARRAY['shop','games','coaching','tournaments'],
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS discount_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scope TEXT NOT NULL,
    reference TEXT,
    discount_paise INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS wallet_topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    credited_at TIMESTAMPTZ
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

  // Every sign-up, sign-in, failed sign-in and sign-out, for players and
  // coaches — the admin activity monitor's source for account activity.
  // actor_id has no foreign key on purpose: the history outlives the account.
  `CREATE TABLE IF NOT EXISTS account_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('player','coach')),
    actor_id UUID,
    email TEXT NOT NULL,
    name TEXT,
    kind TEXT NOT NULL CHECK (kind IN ('signup','login','login_failed','logout')),
    ip TEXT,
    user_agent TEXT,
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
  // The email a coach signs up with. Set by an admin, so only a real coach
  // on the roster can claim a coach login.
  `ALTER TABLE coaches ADD COLUMN IF NOT EXISTS email TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS whatsapp_posted_at TIMESTAMPTZ`,
  `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS partner_name TEXT`,
  `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS seed INTEGER`,
  `ALTER TABLE game_registrations ADD COLUMN IF NOT EXISTS reference TEXT`,
  `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS reference TEXT`,

  // Daily games: a slot either charges a flat per-player price, or splits a
  // court's hourly fee evenly across the players it holds.
  `ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'fixed'`,
  `ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_pricing_mode_check`,
  `ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_pricing_mode_check
     CHECK (pricing_mode IN ('fixed','split'))`,
  `ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS court_fee_paise INTEGER NOT NULL DEFAULT 0`,

  // Answers to the admin-authored fields on a tournament entry form.
  `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::jsonb`,
  // Entries run through an account now, so a player can see their own draws.
  `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL`,

  // What a discount actually took off, stored on the record it was applied to,
  // so reporting can show gross, discount and net without re-deriving anything.
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT`,
  // A 2.5% convenience fee applies to goods only — never to court time, which
  // is a service the club already prices per head.
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS convenience_fee_paise INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_ref TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`,
  // The lifecycle the console actually drives: placed -> confirmed ->
  // dispatched -> delivered. The older values stay legal so existing rows and
  // any in-flight order keep validating.
  `ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check`,
  `ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_status_check
     CHECK (fulfillment_status IN ('new','confirmed','packed','dispatched','shipped','delivered','cancelled'))`,
  // A slot booked through the unified checkout carries that checkout's
  // reference, so one basket resolves to one confirmation for the player.
  `ALTER TABLE game_registrations ADD COLUMN IF NOT EXISTS order_ref TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_paise INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE game_registrations ADD COLUMN IF NOT EXISTS discount_code TEXT`,
  `ALTER TABLE game_registrations ADD COLUMN IF NOT EXISTS discount_paise INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE coaching_bookings ADD COLUMN IF NOT EXISTS discount_code TEXT`,
  `ALTER TABLE coaching_bookings ADD COLUMN IF NOT EXISTS discount_paise INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS discount_code TEXT`,
  `ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS discount_paise INTEGER NOT NULL DEFAULT 0`,

  // Playing up a band is allowed, but an admin decides. Playing down never is.
  `ALTER TABLE game_registrations DROP CONSTRAINT IF EXISTS game_registrations_status_check`,
  `ALTER TABLE game_registrations ADD CONSTRAINT game_registrations_status_check
     CHECK (status IN ('confirmed','waitlist','cancelled','pending_approval','declined'))`,
  `ALTER TABLE game_registrations ADD COLUMN IF NOT EXISTS approval_note TEXT`,

  // Profile: date of birth rather than an age column, because a stored age is
  // wrong within a year of being entered.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT`,
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gender_check`,
  `ALTER TABLE users ADD CONSTRAINT users_gender_check
     CHECK (gender IS NULL OR gender IN ('male','female','other','undisclosed'))`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(lower(handle)) WHERE handle IS NOT NULL`,

  // Backfill handles for accounts created before public profiles existed, so
  // every player is reachable in the directory rather than only new signups.
  `UPDATE users SET handle = trim(both '-' from regexp_replace(lower(left(full_name, 24)), '[^a-z0-9]+', '-', 'g'))
     || '-' || left(replace(id::text, '-', ''), 6)
   WHERE handle IS NULL AND full_name IS NOT NULL AND full_name <> ''`,

  // A booking is tied to an account now, so guest columns are optional.
  `ALTER TABLE game_registrations ALTER COLUMN player_phone DROP NOT NULL`,
  // Phone stopped being the booking identity once every booking carries an
  // account; two players sharing a household number are two bookings.
  `ALTER TABLE game_registrations DROP CONSTRAINT IF EXISTS game_registrations_session_id_player_phone_key`,
  `ALTER TABLE game_registrations ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ`,

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
  // Wallets are postpaid: the balance may go negative, down to a floor. The old
  // non-negative constraint is dropped rather than relaxed in place, because an
  // ADD CONSTRAINT on a name that already exists is an error, and this file is
  // re-run on every cold start.
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wallet_non_negative`,
  `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wallet_floor`,
  `ALTER TABLE users ADD CONSTRAINT users_wallet_floor CHECK (wallet_balance_paise >= -100000)`,

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

  // A basket a code has covered in full is recorded as 'free': nothing is owed
  // and nothing is sent to the gateway. Without this the checkout raises a
  // constraint violation on the insert, so a 100%-off code fails the order
  // outright — after the code has already been claimed.
  `ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check`,
  `ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
     CHECK (payment_method IN ('razorpay','cod','venue','wallet','free'))`,
  `ALTER TABLE game_registrations DROP CONSTRAINT IF EXISTS game_registrations_payment_method_check`,
  `ALTER TABLE game_registrations ADD CONSTRAINT game_registrations_payment_method_check
     CHECK (payment_method IN ('razorpay','cod','venue','wallet','free'))`,
  `ALTER TABLE coaching_bookings DROP CONSTRAINT IF EXISTS coaching_bookings_payment_method_check`,
  `ALTER TABLE coaching_bookings ADD CONSTRAINT coaching_bookings_payment_method_check
     CHECK (payment_method IN ('razorpay','cod','venue','wallet','free'))`,
  `ALTER TABLE tournament_registrations DROP CONSTRAINT IF EXISTS tournament_registrations_payment_method_check`,
  `ALTER TABLE tournament_registrations ADD CONSTRAINT tournament_registrations_payment_method_check
     CHECK (payment_method IN ('razorpay','cod','venue','wallet','free'))`,
  // Repair JSON saved as a quoted string. Until the write paths were fixed,
  // lists like product specs and tournament categories were stored as jsonb
  // strings, which the site read as empty — or, for a product gallery,
  // iterated letter by letter. Converts only strings that hold a JSON list or
  // object; anything else is left exactly as it is.
  `DO $repair$
DECLARE r record; n integer;
BEGIN
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND data_type = 'jsonb' LOOP
    BEGIN
      EXECUTE format(
        'UPDATE %I SET %I = (%I #>> ''{}'')::jsonb WHERE jsonb_typeof(%I) = ''string'' AND left(ltrim(%I #>> ''{}''), 1) IN (''['', ''{'')',
        r.table_name, r.column_name, r.column_name, r.column_name, r.column_name);
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN RAISE NOTICE 'repaired %.%: % rows', r.table_name, r.column_name, n; END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'left %.% as it was: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
END
$repair$`,
];

export const SCHEMA_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_account_events_recent ON account_events(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_account_events_actor ON account_events(actor_id, created_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_coaches_email ON coaches(lower(email)) WHERE email IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_coach_date ON coaching_bookings(coach_id, preferred_date)`,
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE active`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_date ON game_sessions(session_date)`,
  `CREATE INDEX IF NOT EXISTS idx_regs_session ON game_registrations(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_regs_phone ON game_registrations(player_phone)`,
  // Bookings are per account now, so one player can hold one place in a slot.
  // Phone is no longer the identity — an account without one still books.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_regs_session_user
     ON game_registrations(session_id, user_id) WHERE user_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_regs_reference ON game_registrations(reference)`,
  `CREATE INDEX IF NOT EXISTS idx_tourn_reg_reference ON tournament_registrations(reference)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_coach ON coaching_bookings(coach_id)`,
  `CREATE INDEX IF NOT EXISTS idx_coaching_created ON coaching_bookings(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tourn_reg_tournament ON tournament_registrations(tournament_id)`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_status ON whatsapp_outbox(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_topups_status ON wallet_topups(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)`,
  `CREATE INDEX IF NOT EXISTS idx_coach_avail ON coach_availability(coach_id, weekday)`,
  `CREATE INDEX IF NOT EXISTS idx_form_fields_tournament ON tournament_form_fields(tournament_id, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_time_slots_active ON time_slots(sort_order) WHERE active`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
  `CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_regs_order_ref ON game_registrations(order_ref)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_code ON discount_codes(upper(code))`,
  `CREATE INDEX IF NOT EXISTS idx_discount_active ON discount_codes(active, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_redemptions_code ON discount_redemptions(code_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_redemptions_user ON discount_redemptions(user_id, code_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tourn_regs_user ON tournament_registrations(user_id)`,
];

let ensured = false;
let inflight: Promise<void> | null = null;

/**
 * A fingerprint of every statement above. When the code's DDL changes, so does
 * this, and the next cold start applies it; when it has not, nothing runs.
 * FNV-1a rather than node:crypto so this module stays importable anywhere.
 */
const SCHEMA_VERSION = (() => {
  let h = 0x811c9dc5;
  for (const ch of [...SCHEMA_TABLES, ...SCHEMA_MIGRATIONS, ...SCHEMA_INDEXES].join(String.fromCharCode(10))) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
})();

/** Postgres "lock_not_available" — the DDL gave up rather than wait. */
const LOCK_TIMEOUT = "55P03";

/**
 * Idempotent bootstrap, safe to call from any route.
 *
 * This used to run all ~150 statements on every cold start. On a fresh deploy
 * that is every instance at once, and `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
 * takes an ACCESS EXCLUSIVE lock even when the column already exists. One slow
 * or abandoned read on `users` made that ALTER wait, and every later query on
 * `users` queued behind the ALTER: pages hung for a minute at a time.
 *
 * Now:
 *   - Fast path: one read of the stored schema version. If it matches, done —
 *     no DDL, no locks beyond an ordinary read.
 *   - Slow path, only after the schema changes: each statement runs in its own
 *     short transaction with a one-second lock_timeout, so DDL gives up rather
 *     than queue behind readers and stall the site. SET LOCAL keeps that
 *     setting inside the transaction, which matters behind a pooler that hands
 *     the same connection to other requests.
 *
 * Failures are logged, never thrown: a page that can render should not 500
 * because a migration had to wait for a quieter moment.
 */
export async function ensureSchema(force = false): Promise<void> {
  if (!isDbConfigured) return;
  if (ensured && !force) return;
  // Concurrent first requests on one instance share a single run.
  inflight ??= apply(force).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function apply(force: boolean): Promise<void> {
  if (!force) {
    const current = await query<{ version: string }>(`SELECT version FROM schema_meta WHERE id = 1`).catch(() => []);
    if (current[0]?.version === SCHEMA_VERSION) {
      ensured = true;
      return;
    }
  }

  const sql = getSql();
  let waitedOut = 0;
  let failed = 0;
  const groups: Array<[string, string[]]> = [
    ["table", [SCHEMA_META_TABLE, ...SCHEMA_TABLES]],
    ["migration", SCHEMA_MIGRATIONS],
    ["index", SCHEMA_INDEXES],
  ];
  for (const [label, statements] of groups) {
    for (const stmt of statements) {
      try {
        // One simple-protocol message, which Postgres runs as a single implicit
        // transaction: SET LOCAL applies to this DDL and is gone afterwards, so
        // nothing leaks onto the pooled connection. Not sql.begin — with
        // pipelining disabled (see lib/db.ts) postgres.js never reserves the
        // connection for it, and every statement failed as UNSAFE_TRANSACTION.
        await sql.unsafe(`SET LOCAL lock_timeout = '1s'; ${stmt}`);
      } catch (err) {
        failed++;
        if ((err as { code?: string })?.code === LOCK_TIMEOUT) waitedOut++;
        console.error(`[schema] ${label} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // Record the version only when every statement went through. Anything that
  // failed — a lock it had to give up on, or anything else — leaves it stale,
  // so a later cold start tries again rather than believing it is done.
  if (failed === 0) {
    await query(
      `INSERT INTO schema_meta (id, version, applied_at) VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, applied_at = now()`,
      [SCHEMA_VERSION],
    ).catch((err) => console.error("[schema] version write failed:", err instanceof Error ? err.message : err));
  } else {
    console.warn(
      `[schema] ${failed} statement(s) failed (${waitedOut} backed off for a lock); will retry on a later start`,
    );
  }
  ensured = true;
}

const SCHEMA_META_TABLE = `CREATE TABLE IF NOT EXISTS schema_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

/** Full DDL as one script — what supabase/schema.sql contains. */
export function schemaSql(): string {
  return [
    "-- SuperPro — generated from lib/schema.ts. Do not edit by hand.",
    "-- Run this in the Supabase SQL editor, or POST /api/db-init once deployed.",
    "",
    ...[SCHEMA_META_TABLE, ...SCHEMA_TABLES, ...SCHEMA_MIGRATIONS, ...SCHEMA_INDEXES].map((s) => `${s.trim()};`),
    "",
  ].join("\n\n");
}
