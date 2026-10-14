/**
 * Sparvic Open Tournament — event details from the organiser's deck, and the
 * entry rules both the form and the server enforce.
 *
 * Client-safe: no database imports.
 */

export const OPEN = {
  slug: "sparvic-open",
  name: "Sparvic Open Tournament",
  tagline: "Three days of competitive play in Kolkata.",
  dates: "30 October – 1 November 2026",
  venue: "TurfXL New Alipore, Kolkata",
  contactDisplay: "91631 32551",
  contactDigits: "919163132551",
  /** The club's ceiling for this event: every player must be rated below this. */
  maxDupr: 4.0,
  duprAsOf: "10 October 2026",
  earlyOffer: "Participants registered before 15 October get a special offer.",
} as const;

export type OpenCategory = {
  id: string;
  label: string;
  type: "singles" | "doubles";
  gender: "men" | "women" | "mixed";
  /** Published band: player (and partner) DUPR must be under this. */
  band: number;
  feePaise: number;
  gold: number;
  silver: number;
};

export const OPEN_CATEGORIES: OpenCategory[] = [
  { id: "ms-3599", label: "Men's Singles DUPR < 3.599", type: "singles", gender: "men", band: 3.599, feePaise: 160000, gold: 7000, silver: 4500 },
  { id: "ms-4099", label: "Men's Singles DUPR < 4.099", type: "singles", gender: "men", band: 4.099, feePaise: 160000, gold: 7000, silver: 4500 },
  { id: "ms-4599", label: "Men's Singles DUPR < 4.599", type: "singles", gender: "men", band: 4.599, feePaise: 160000, gold: 6000, silver: 4000 },
  { id: "md-3599", label: "Men's Doubles DUPR < 3.599", type: "doubles", gender: "men", band: 3.599, feePaise: 250000, gold: 12000, silver: 8000 },
  { id: "md-4299", label: "Men's Doubles DUPR < 4.299", type: "doubles", gender: "men", band: 4.299, feePaise: 300000, gold: 12000, silver: 8000 },
  { id: "wd-3599", label: "Women's Doubles DUPR < 3.599", type: "doubles", gender: "women", band: 3.599, feePaise: 200000, gold: 6000, silver: 4000 },
  { id: "wd-4099", label: "Women's Doubles DUPR < 4.099", type: "doubles", gender: "women", band: 4.099, feePaise: 200000, gold: 6000, silver: 4000 },
  { id: "xd-3599", label: "Mixed Doubles DUPR < 3.599", type: "doubles", gender: "mixed", band: 3.599, feePaise: 250000, gold: 12000, silver: 9000 },
  { id: "xd-4099", label: "Mixed Doubles DUPR < 4.099", type: "doubles", gender: "mixed", band: 4.099, feePaise: 250000, gold: 12000, silver: 9000 },
];

export const MATCH_FORMAT = { group: 11, knockouts: 11, semis: 15, finals: "11 (best of 3)" };

export const OPEN_RULES: Array<{ title: string; points: string[] }> = [
  { title: "Scoring", points: ["All matches are played to 11 points on service, win by 2.", "Only the serving team may score. At 10–10, continue until a 2-point lead.", "Standard USA Pickleball serving rules; the server continues until the serving team faults."] },
  { title: "Warm-up time", points: ["Warm-up is strictly limited to 1 minute.", "The referee signals the start and end; play begins immediately."] },
  { title: "Punctuality & walkover", points: ["Report at the scheduled match time.", "A 10-minute grace period applies; the referee may award a walkover after that."] },
  { title: "Referee authority", points: ["The referee's decision is final and binding.", "Clarification may be requested politely; no arguing, protesting or disputes.", "Spectators, coaches and bystanders must not interfere.", "Continued disputes or disrespect may lead to a point penalty or disqualification."] },
  { title: "Code of conduct", points: ["No foul, abusive or disrespectful language on or near the courts.", "Applies to players, coaches and spectators.", "First offence: formal warning. Second offence may lead to a point deduction or disqualification."] },
];

export const ELIGIBILITY = [
  { title: "Meet the threshold", body: `You and your partner must be under the DUPR band of every category you enter, as on ${OPEN.duprAsOf}. This event is for players rated below ${OPEN.maxDupr.toFixed(1)}.` },
  { title: "Checked at registration", body: "If any manipulation of DUPR is found, the player or team is disqualified." },
  { title: "Multiple accounts", body: "If a player has more than one DUPR account, the one with the higher rating counts." },
  { title: "Reliability cap 50%", body: "In a < 3.599 category, a player rated 3.6 with reliability of 50% or less is still permitted." },
];

export type PlayerFacts = { dupr: number | null; gender: string | null };
export type EntryInput = { category: string; partner_name?: string; partner_phone?: string; partner_dupr?: number | null };

/** Why a player can't enter the event at all, or null when they can. */
export function playerBlock(p: PlayerFacts): string | null {
  if (p.dupr == null || !Number.isFinite(p.dupr)) return "Add your DUPR rating to enter: draws and eligibility run off it.";
  if (p.dupr >= OPEN.maxDupr) return `The Sparvic Open is for players rated below ${OPEN.maxDupr.toFixed(1)} DUPR. Your rating is ${p.dupr.toFixed(2)}.`;
  if (p.gender !== "male" && p.gender !== "female") return "Set your gender in your profile so we can offer the right categories.";
  return null;
}

/** Whether this player may pick a category, and why not. */
export function categoryBlock(cat: OpenCategory, p: PlayerFacts): string | null {
  const base = playerBlock(p);
  if (base) return base;
  if (cat.gender === "men" && p.gender !== "male") return "Men's category";
  if (cat.gender === "women" && p.gender !== "female") return "Women's category";
  if ((p.dupr as number) > cat.band) return `Your DUPR ${(p.dupr as number).toFixed(2)} is above this band`;
  return null;
}

/** Full validation of one checkout's selections. Returns an error message, or null. */
export function validateEntries(entries: EntryInput[], p: PlayerFacts, taken: Set<string> = new Set()): string | null {
  const base = playerBlock(p);
  if (base) return base;
  if (!entries.length) return "Pick at least one category.";
  const seen = new Set<string>();
  for (const e of entries) {
    const cat = OPEN_CATEGORIES.find((c) => c.id === e.category);
    if (!cat) return "One of those categories doesn't exist.";
    if (seen.has(cat.id)) return `${cat.label} is selected twice.`;
    seen.add(cat.id);
    if (taken.has(cat.id)) return `You're already entered in ${cat.label}.`;
    const why = categoryBlock(cat, p);
    if (why) return `${cat.label}: ${why}.`;
    if (cat.type === "doubles") {
      if (!e.partner_name || e.partner_name.trim().length < 2) return `${cat.label}: add your partner's name.`;
      if (!/^\d{10}$/.test(e.partner_phone ?? "")) return `${cat.label}: add your partner's 10-digit phone number.`;
      const d = e.partner_dupr;
      if (d == null || !Number.isFinite(d)) return `${cat.label}: add your partner's DUPR rating.`;
      if (d >= OPEN.maxDupr) return `${cat.label}: your partner must be rated below ${OPEN.maxDupr.toFixed(1)}.`;
      if (d > cat.band) return `${cat.label}: your partner's DUPR ${d.toFixed(2)} is above this band.`;
    }
  }
  return null;
}

export const totalPaise = (ids: string[]) =>
  ids.reduce((sum, id) => sum + (OPEN_CATEGORIES.find((c) => c.id === id)?.feePaise ?? 0), 0);
