/**
 * The SuperPro group-coaching programme — the poster, the WhatsApp blurb and
 * the old Google Form, as data. Prices and venues live here so the form, the
 * server (which computes what to charge) and the coach dashboard all agree.
 */

export const PROGRAM = {
  name: "SuperPro by Sparvic",
  title: "Beginner Pickleball Coaching",
  tagline: "Learn. Play. Love Pickleball.",
  classesPerMonth: 8,
  minGroupSize: 3,
  phoneDisplay: "+91 91631 32551",
  phoneDigits: "919163132551",
  instagram: "https://www.instagram.com/superprosports_official/",
  instagramHandle: "superprosports_official",
} as const;

export const COACH = {
  slug: "ishaan-chetani",
  name: "Ishaan Chetani",
  headline: "Head coach · SuperPro by Sparvic",
  image: "/coaching/ishaan-chetani.jpg",
  poster: "/coaching/ishaan-chetani-poster.jpg",
  bio:
    "Ishaan runs SuperPro's beginner programme: small groups, personalised coaching and the fundamentals done properly — grip, dinking, serves and kitchen rules — so new players are rallying with confidence within the month.",
  achievements: ["15-time podium finisher across beginner and intermediate tournaments"],
  specialties: ["Beginner fundamentals", "Small-group coaching", "Private sessions", "Dinking & kitchen play"],
} as const;

/** What a beginner learns in the month. */
export const CURRICULUM = ["Grip", "Dinking", "Serves", "Kitchen rules", "Footwork & positioning", "Game play & scoring"];

export const HIGHLIGHTS = [
  "Monthly batches with flexible slots",
  "Small groups, personalised coaching",
  "All equipment provided",
  "Beginner-friendly — no experience needed",
  "A great way to meet the community",
  "Private sessions also available",
];

export type Venue = {
  id: string;
  name: string;
  area: string;
  /** Per person for the month, in rupees. null = not offered. */
  kids: number | null;
  adults: number;
  timing: string;
};

export const VENUES: Venue[] = [
  { id: "pickacourt", name: "11:11 Pickacourt", area: "New Alipore", kids: 4000, adults: 5000, timing: "6 AM – 8 AM · 6 PM – 10 PM" },
  { id: "turfxl", name: "Turf XL", area: "New Alipore", kids: 4000, adults: 5000, timing: "6 AM – 8 AM · 6 PM – 10 PM" },
  { id: "sportsplex", name: "SportsPlex", area: "Kolkata", kids: 4000, adults: 6000, timing: "7 AM – 9 AM · 6 PM – 10 PM" },
  { id: "ballygunge", name: "Ballygunge Arena", area: "Ballygunge", kids: null, adults: 8000, timing: "7 AM – 9 AM · 6 PM – 10 PM" },
];

/** Under 16 pays the kids' rate. */
export const KIDS_MAX_AGE = 15;

export const GENDERS = ["Male", "Female"] as const;

export const SKILLS = [
  { id: "beginner", label: "Beginner — never played before" },
  { id: "novice", label: "Novice — played a few times" },
  { id: "regular", label: "Plays regularly" },
] as const;

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const TIMINGS = [
  "6 AM – 7 AM",
  "7 AM – 8 AM",
  "8 AM – 9 AM",
  "6 PM – 7 PM",
  "7 PM – 8 PM",
  "8 PM – 9 PM",
  "9 PM – 10 PM",
] as const;

export const MIN_DAYS = 4;
export const MIN_TIMINGS = 4;

export function venueById(id: string): Venue | undefined {
  return VENUES.find((v) => v.id === id);
}

/** Monthly fee in rupees for this venue and age, or null when not offered (kids at Ballygunge). */
export function feeFor(venueId: string, age: number): number | null {
  const v = venueById(venueId);
  if (!v) return null;
  return age <= KIDS_MAX_AGE ? v.kids : v.adults;
}

/** "October 2026" — the batch a registration made today belongs to. */
export function currentBatch(now = new Date()): string {
  return now.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

export const formatRupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
