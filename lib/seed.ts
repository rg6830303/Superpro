import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { upcomingDates } from "@/lib/dates";

/**
 * Idempotent seed. Every insert is ON CONFLICT DO NOTHING keyed on a natural
 * key (slug / name / date+time), so running it twice never duplicates data and
 * never overwrites edits made from the admin console.
 */

const PRODUCTS = [
  {
    slug: "champion-series-t700",
    name: "Champion Series T700",
    category: "paddles",
    tagline: "The flagship. Toray T700 carbon, thermoformed, unforgiving on the other side of the net.",
    description:
      "Our top paddle: a 16mm thermoformed unibody with a raw Toray T700 carbon-fibre face and a polypropylene honeycomb core. Enormous spin off the face, a sweet spot that forgives the ends of long rallies, and foam-injected walls that keep the ball on the string bed a fraction longer for hands battles at the kitchen.",
    specs: [
      "16 mm thermoformed unibody",
      "Raw Toray T700 carbon face",
      "Polypropylene honeycomb core",
      "Foam-injected perimeter walls",
      "Weight 8.0–8.3 oz · 5.3\" handle",
      "USAP-approved dimensions",
    ],
    price_paise: 900000,
    compare_at_paise: 1100000,
    image_url: "/products/paddle-champion-t700.png",
    gallery: ["/products/paddle-champion-t700.png", "/products/paddle-ball-hero.png"],
    stock: 24,
    featured: true,
    sort_order: 1,
  },
  {
    slug: "champion-series-16-pro",
    name: "Champion Series 16 Pro",
    category: "paddles",
    tagline: "All-court control paddle with a plush 16 mm core and a quiet, planted feel.",
    description:
      "Built for the player who wins with placement. The 16mm core dampens pace so dinks sit down inside the kitchen, while the elongated head keeps enough reach for a put-away. The most-played paddle in our daily games.",
    specs: [
      "16 mm polypropylene core",
      "Textured composite face",
      "Elongated head shape",
      "Weight 7.8–8.1 oz",
      "Edge guard with sweat channel",
    ],
    price_paise: 780000,
    compare_at_paise: 890000,
    image_url: "/products/paddle-edge-16mm.png",
    gallery: ["/products/paddle-edge-16mm.png", "/products/paddle-edge-16mm-vertical.png"],
    stock: 36,
    featured: true,
    sort_order: 2,
  },
  {
    slug: "champion-series-starter",
    name: "Champion Series Starter",
    category: "paddles",
    tagline: "Your first serious paddle — light, stable, and impossible to outgrow in month one.",
    description:
      "A fibreglass face over a 13mm core: more pop for players still building swing speed, and a forgiving face that keeps mishits in play. The paddle we hand to anyone walking onto court for the first time.",
    specs: [
      "13 mm polypropylene core",
      "Fibreglass face",
      "Weight 7.6–7.9 oz",
      "Cushioned perforated grip",
      "Includes paddle cover",
    ],
    price_paise: 450000,
    compare_at_paise: null,
    image_url: "/products/paddle-edge-16mm-vertical.png",
    gallery: ["/products/paddle-edge-16mm-vertical.png"],
    stock: 48,
    featured: false,
    sort_order: 3,
  },
  {
    slug: "superpro-outdoor-40-3pack",
    name: "SuperPro Outdoor 40 — 3 pack",
    category: "balls",
    tagline: "40-hole outdoor ball, seam-welded to survive a Kolkata summer.",
    description:
      "Rotationally moulded with a seam-welded equator so it does not crack open after two humid weeks. True flight in wind, consistent bounce off turf and acrylic.",
    specs: ["40 holes · outdoor", "Seam-welded construction", "26 g ± 1 g", "USAP-spec bounce", "3 balls per pack"],
    price_paise: 90000,
    compare_at_paise: null,
    image_url: "/products/paddle-ball-hero.png",
    gallery: ["/products/paddle-ball-hero.png"],
    stock: 120,
    featured: true,
    sort_order: 4,
  },
  {
    slug: "superpro-outdoor-40-dozen",
    name: "SuperPro Outdoor 40 — dozen",
    category: "balls",
    tagline: "The club box. What we put on court every morning.",
    description: "Twelve outdoor 40-hole balls in a reusable tube. Priced for clubs, academies and anyone running open play.",
    specs: ["12 balls", "40 holes · outdoor", "Reusable tube", "Optic yellow"],
    price_paise: 320000,
    compare_at_paise: 360000,
    image_url: "/products/paddle-ball-hero.png",
    gallery: ["/products/paddle-ball-hero.png"],
    stock: 40,
    featured: false,
    sort_order: 5,
  },
  {
    slug: "superpro-indoor-26",
    name: "SuperPro Indoor 26 — 3 pack",
    category: "balls",
    tagline: "Softer 26-hole indoor ball for wood and synthetic courts.",
    description: "Larger holes, softer shell, slower flight — the right ball when you move play indoors.",
    specs: ["26 holes · indoor", "Softer shell", "3 balls per pack"],
    price_paise: 75000,
    compare_at_paise: null,
    image_url: "/products/paddle-ball-hero.png",
    gallery: [],
    stock: 60,
    featured: false,
    sort_order: 6,
  },
  {
    slug: "superpro-tacky-overgrip",
    name: "SuperPro Tacky Overgrip — 3 pack",
    category: "grips",
    tagline: "Perforated tacky overgrip that holds through a humid third game.",
    description:
      "0.6mm perforated PU overgrip with a dry-tack finish. Wicks sweat instead of sliding, and the perforations stop the grip from going slick at the top of the handle.",
    specs: ["0.6 mm perforated PU", "Dry-tack finish", "3 grips + finishing tape", "White / black"],
    price_paise: 45000,
    compare_at_paise: null,
    image_url: "/products/grip-band-gold.png",
    gallery: ["/products/grip-band-gold.png"],
    stock: 150,
    featured: false,
    sort_order: 7,
  },
  {
    slug: "superpro-gold-band",
    name: "SuperPro Gold Series Band",
    category: "grips",
    tagline: "Gold-badge wristband — sweat management with the club mark on it.",
    description:
      "Woven wristband with the SuperPro mark in brushed gold. Wide enough to actually catch sweat before it reaches the grip.",
    specs: ["Woven terry-back band", "Brushed gold badge", "One size", "Machine washable"],
    price_paise: 70000,
    compare_at_paise: null,
    image_url: "/products/grip-band-gold.png",
    gallery: ["/products/grip-band-gold.png"],
    stock: 80,
    featured: true,
    sort_order: 8,
  },
  {
    slug: "superpro-cushion-grip",
    name: "SuperPro Cushion Replacement Grip",
    category: "grips",
    tagline: "Full replacement grip when the original has flattened out.",
    description: "1.6mm cushioned replacement grip with a tapered end so the handle keeps its shape.",
    specs: ["1.6 mm cushion", "Tapered build", "Includes end tape"],
    price_paise: 55000,
    compare_at_paise: null,
    image_url: "/products/grip-band-gold.png",
    gallery: [],
    stock: 90,
    featured: false,
    sort_order: 9,
  },
];

const VENUES = [
  {
    name: "TurfXL",
    area: "New Alipore",
    address: "TurfXL, New Alipore, Kolkata 700053",
    courts: 4,
    maps_url: "https://maps.google.com/?q=TurfXL+New+Alipore+Kolkata",
    sort_order: 1,
  },
  {
    name: "Sportsplex Indoor",
    area: "Salt Lake",
    address: "Sportsplex, Sector V, Salt Lake, Kolkata 700091",
    courts: 2,
    maps_url: "https://maps.google.com/?q=Sportsplex+Salt+Lake+Kolkata",
    sort_order: 2,
  },
];

const COACHES = [
  {
    slug: "arindam-basu",
    name: "Arindam Basu",
    headline: "Head coach · DUPR 5.4 · builds third-shot discipline",
    bio: "Ten years across tennis and pickleball, and the coach most of our tournament players came up under. Arindam rebuilds your third shot first — drop before drive — then hands you the patterns that win the kitchen exchange.",
    specialties: ["Third-shot drop", "Kitchen strategy", "Doubles positioning"],
    dupr: 5.4,
    experience_years: 10,
    rate_paise: 150000,
    languages: "English, Hindi, Bengali",
    available_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    sort_order: 1,
  },
  {
    slug: "riya-mehta",
    name: "Riya Mehta",
    headline: "Beginner specialist · DUPR 4.6 · zero-to-rally in four sessions",
    bio: "Riya coaches first-timers and improvers. Her four-session block takes someone who has never held a paddle to holding their own in an open game — grip, serve, return, and enough dinking to survive the kitchen.",
    specialties: ["First-timers", "Serve & return", "Women's clinics"],
    dupr: 4.6,
    experience_years: 5,
    rate_paise: 110000,
    languages: "English, Hindi",
    available_days: ["Tue", "Wed", "Thu", "Sat", "Sun"],
    sort_order: 2,
  },
  {
    slug: "sameer-khan",
    name: "Sameer Khan",
    headline: "Power & speed-up coach · DUPR 5.1",
    bio: "Ex-badminton state player who moved to pickleball in 2022. Sameer works on hands speed: counter-attacks, resets under pressure, and the speed-up timing that separates 3.5 from 4.5.",
    specialties: ["Hands battles", "Counter-attack", "Reset under pressure"],
    dupr: 5.1,
    experience_years: 6,
    rate_paise: 130000,
    languages: "English, Hindi, Bengali",
    available_days: ["Mon", "Wed", "Fri", "Sat"],
    sort_order: 3,
  },
  {
    slug: "debolina-roy",
    name: "Debolina Roy",
    headline: "Junior programme lead · DUPR 4.3",
    bio: "Runs the under-16 batch and the school outreach programme. Debolina's sessions are built around movement and footwork first, technique second — which is why her juniors keep improving after they leave the court.",
    specialties: ["Juniors (8–16)", "Footwork", "Group clinics"],
    dupr: 4.3,
    experience_years: 4,
    rate_paise: 95000,
    languages: "English, Bengali",
    available_days: ["Sat", "Sun"],
    sort_order: 4,
  },
];

const TOURNAMENTS = [
  {
    slug: "legends-challengers-3",
    title: "Legends & Challengers — 3rd Edition",
    kind: "organized",
    status: "open",
    start_date: "2026-10-17",
    end_date: "2026-10-18",
    venue: "TurfXL, New Alipore",
    format: "Split-age doubles · round robin into knockouts",
    categories: ["Men's Doubles", "Women's Doubles", "Mixed Doubles"],
    prize_pool_paise: 2500000,
    entry_fee_paise: 150000,
    max_teams: 24,
    dupr_cap: 8.7,
    summary:
      "The third edition of our flagship doubles event. 24 teams, three categories, round-robin groups into a knockout on day two.",
    description:
      "Legends & Challengers pairs an experienced player with a challenger and rewards the pair that adapts fastest. Groups of four play round robin on Saturday; the top two from each group go through to Sunday's knockout. Entry covers both days, balls, and lunch. DUPR aggregate for a team is capped at 8.7.",
    registration_open: true,
    partner_name: null,
    result_note: null,
  },
  {
    slug: "trickshotz-rally-2026",
    title: "Trickshotz Rally",
    kind: "organized",
    status: "completed",
    start_date: "2026-08-15",
    end_date: "2026-08-15",
    venue: "TurfXL, New Alipore",
    format: "16 teams · trick-shot format",
    categories: ["Open Doubles"],
    prize_pool_paise: 1500000,
    entry_fee_paise: 120000,
    max_teams: 16,
    dupr_cap: 8.7,
    summary: "One-day trick-shot format with a ₹15,000 prize pool and a DUPR aggregate cap of 8.7.",
    description:
      "A one-day format where points are scored for shot difficulty as well as the rally itself. Sixteen teams, a full house, and the loudest crowd we have had on court.",
    registration_open: false,
    partner_name: null,
    result_note: "Winners: Vivek Burman & Mayank Parakh",
  },
  {
    slug: "beginners-doubles-2026",
    title: "Beginners Doubles Tournament",
    kind: "organized",
    status: "completed",
    start_date: "2026-06-05",
    end_date: "2026-06-06",
    venue: "TurfXL, New Alipore",
    format: "19 teams · round robin",
    categories: ["Beginner Doubles"],
    prize_pool_paise: 1080000,
    entry_fee_paise: 80000,
    max_teams: 20,
    dupr_cap: 6.5,
    summary: "Nineteen teams, every one of them playing their first competitive pickleball.",
    description:
      "Built for players inside their first year. No DUPR requirement, a guaranteed four matches per team, and a coach on every court giving feedback between games.",
    registration_open: false,
    partner_name: null,
    result_note: "₹10,800 prize pool · 19 teams",
  },
  {
    slug: "bengal-open-2026",
    title: "Bengal Open 2026",
    kind: "sponsored",
    status: "announced",
    start_date: "2026-11-21",
    end_date: "2026-11-23",
    venue: "Netaji Indoor Stadium, Kolkata",
    format: "State-level open · singles and doubles",
    categories: ["Men's Singles", "Women's Singles", "Open Doubles"],
    prize_pool_paise: 10000000,
    entry_fee_paise: 0,
    max_teams: 128,
    dupr_cap: null,
    summary: "SuperPro is the official paddle and ball partner for the Bengal Open 2026.",
    description:
      "Kolkata's largest pickleball weekend. SuperPro supplies match balls for all courts and equips the referee crew. Registration is handled by the organising committee — the link goes live in October.",
    registration_open: false,
    partner_name: "Bengal Pickleball Association",
    result_note: null,
  },
];

async function seedProducts() {
  for (const p of PRODUCTS) {
    await query(
      `INSERT INTO products (slug, name, category, tagline, description, specs, price_paise,
        compare_at_paise, image_url, gallery, stock, featured, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb,$11,$12,true,$13)
       ON CONFLICT (slug) DO NOTHING`,
      [
        p.slug,
        p.name,
        p.category,
        p.tagline,
        p.description,
        JSON.stringify(p.specs),
        p.price_paise,
        p.compare_at_paise,
        p.image_url,
        JSON.stringify(p.gallery),
        p.stock,
        p.featured,
        p.sort_order,
      ],
    );
  }
}

async function seedVenues() {
  for (const v of VENUES) {
    const existing = await queryOne<{ id: string }>("SELECT id FROM venues WHERE name = $1", [v.name]);
    if (existing) continue;
    await query(
      `INSERT INTO venues (name, area, address, courts, maps_url, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,true,$6)`,
      [v.name, v.area, v.address, v.courts, v.maps_url, v.sort_order],
    );
  }
}

async function seedCoaches() {
  for (const c of COACHES) {
    await query(
      `INSERT INTO coaches (slug, name, headline, bio, specialties, dupr, experience_years,
        rate_paise, languages, available_days, active, sort_order)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10::jsonb,true,$11)
       ON CONFLICT (slug) DO NOTHING`,
      [
        c.slug,
        c.name,
        c.headline,
        c.bio,
        JSON.stringify(c.specialties),
        c.dupr,
        c.experience_years,
        c.rate_paise,
        c.languages,
        JSON.stringify(c.available_days),
        c.sort_order,
      ],
    );
  }
}

async function seedTournaments() {
  for (const t of TOURNAMENTS) {
    await query(
      `INSERT INTO tournaments (slug, title, kind, status, start_date, end_date, venue, format,
        categories, prize_pool_paise, entry_fee_paise, max_teams, dupr_cap, summary, description,
        registration_open, partner_name, result_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (slug) DO NOTHING`,
      [
        t.slug,
        t.title,
        t.kind,
        t.status,
        t.start_date,
        t.end_date,
        t.venue,
        t.format,
        JSON.stringify(t.categories),
        t.prize_pool_paise,
        t.entry_fee_paise,
        t.max_teams,
        t.dupr_cap,
        t.summary,
        t.description,
        t.registration_open,
        t.partner_name,
        t.result_note,
      ],
    );
  }
}

/** Morning + evening open-play slots for the next `days` days at every venue. */
export async function seedSessions(days = 7): Promise<number> {
  const venues = await query<{ id: string; name: string; courts: number }>(
    "SELECT id, name, courts FROM venues WHERE active ORDER BY sort_order",
  );
  if (venues.length === 0) return 0;

  const template = [
    { start: "06:30", end: "07:30", level: "all", capacity: 8 },
    { start: "07:30", end: "08:30", level: "beginner", capacity: 8 },
    { start: "18:00", end: "19:00", level: "all", capacity: 8 },
    { start: "19:00", end: "20:00", level: "intermediate", capacity: 8 },
    { start: "20:00", end: "21:00", level: "advanced", capacity: 8 },
  ];

  let created = 0;
  for (const date of upcomingDates(days)) {
    for (const v of venues) {
      const courts = Math.min(v.courts, 2); // seed two courts per venue; admin adds more
      for (let court = 1; court <= courts; court++) {
        for (const t of template) {
          const rows = await query<{ id: string }>(
            `INSERT INTO game_sessions (venue_id, session_date, start_time, end_time, court_number,
               level, capacity, price_paise, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,35000,'open')
             ON CONFLICT (venue_id, session_date, start_time, court_number) DO NOTHING
             RETURNING id`,
            [v.id, date, t.start, t.end, court, t.level, t.capacity],
          );
          created += rows.length;
        }
      }
    }
  }
  return created;
}

/** Reusable time-slot templates the console composes daily games from. */
async function seedTimeSlots() {
  const slots = [
    { label: "Early morning", start: "06:30", end: "07:30", sort: 1 },
    { label: "Morning", start: "07:30", end: "08:30", sort: 2 },
    { label: "Late morning", start: "08:30", end: "09:30", sort: 3 },
    { label: "Evening", start: "18:00", end: "19:00", sort: 4 },
    { label: "Prime evening", start: "19:00", end: "20:00", sort: 5 },
    { label: "Night", start: "20:00", end: "21:00", sort: 6 },
    { label: "Late night", start: "21:00", end: "22:00", sort: 7 },
  ];
  for (const t of slots) {
    await query(
      `INSERT INTO time_slots (label, start_time, end_time, sort_order, active)
       VALUES ($1,$2,$3,$4,true) ON CONFLICT (start_time, end_time) DO NOTHING`,
      [t.label, t.start, t.end, t.sort],
    );
  }
}

async function seedAnnouncements() {
  const existing = await queryOne<{ id: string }>("SELECT id FROM announcements LIMIT 1");
  if (existing) return;
  await query(
    `INSERT INTO announcements (title, body, kind, link_url, active)
     VALUES ($1,$2,$3,$4,true)`,
    [
      "Legends & Challengers 3rd Edition — registration open",
      "24 teams, three categories, ₹25,000 prize pool. Registration closes when the draw fills.",
      "tournament",
      "/tournaments/legends-challengers-3",
    ],
  );
}

/**
 * Create the first admin from ADMIN_EMAIL + ADMIN_PASSWORD_HASH (or
 * ADMIN_PASSWORD as a bootstrap fallback). Existing rows are left untouched.
 */
export async function seedAdmin(): Promise<"created" | "exists" | "skipped"> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const plain = process.env.ADMIN_PASSWORD;
  if (!email || (!hash && !plain)) return "skipped";

  const existing = await queryOne<{ id: string }>("SELECT id FROM admins WHERE email = $1", [email]);
  if (existing) return "exists";

  const passwordHash = hash || (await bcrypt.hash(plain as string, 12));
  await query(
    `INSERT INTO admins (email, password_hash, name, role) VALUES ($1,$2,$3,'owner')
     ON CONFLICT (email) DO NOTHING`,
    [email, passwordHash, "SuperPro Owner"],
  );
  return "created";
}

export async function seedAll(): Promise<Record<string, unknown>> {
  await seedProducts();
  await seedVenues();
  await seedCoaches();
  await seedTournaments();
  await seedTimeSlots();
  await seedAnnouncements();
  // Deliberately no game sessions: the schedule is the club's to compose from
  // the console, and seeding one would fight whatever the admin has already
  // built. The reusable time-slot library above is what the builder needs.
  const admin = await seedAdmin();
  return {
    products: PRODUCTS.length,
    venues: VENUES.length,
    coaches: COACHES.length,
    tournaments: TOURNAMENTS.length,
    timeSlots: 7,
    admin,
  };
}
