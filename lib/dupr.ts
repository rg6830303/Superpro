import type { SkillLevel } from "@/lib/types";

/**
 * DUPR (Dynamic Universal Pickleball Rating) drives a player's category, so the
 * two can never disagree — the rating is what a player enters, and the band is
 * derived from it everywhere (signup, profile, admin).
 *
 *   below 3.5   → beginner
 *   3.5 – 4.0   → intermediate
 *   4.0 and up  → advanced
 */
export const DUPR_BANDS = [
  { level: "beginner" as const, label: "Beginner", range: "Below 3.5", min: 0, max: 3.5 },
  { level: "intermediate" as const, label: "Intermediate", range: "3.5 – 4.0", min: 3.5, max: 4 },
  { level: "advanced" as const, label: "Advanced", range: "4.0 and above", min: 4, max: Infinity },
];

/** Lowest and highest ratings DUPR itself issues. */
export const DUPR_MIN = 2;
export const DUPR_MAX = 8;

/**
 * Map a rating to its category. An unrated player is a beginner by default —
 * that is where the club puts anyone who has not been rated yet.
 */
export function skillFromDupr(rating: number | null | undefined): SkillLevel {
  const value = Number(rating);
  if (!Number.isFinite(value) || value <= 0) return "beginner";
  if (value < 3.5) return "beginner";
  if (value < 4) return "intermediate";
  return "advanced";
}

export function duprBand(rating: number | null | undefined) {
  const level = skillFromDupr(rating);
  return DUPR_BANDS.find((b) => b.level === level) ?? DUPR_BANDS[0];
}

/** "Intermediate · 3.75" for display next to a player's name. */
export function duprLabel(rating: number | null | undefined): string {
  const value = Number(rating);
  if (!Number.isFinite(value) || value <= 0) return "Unrated · Beginner";
  return `${duprBand(value).label} · ${value.toFixed(2)}`;
}

/** DUPR ids are short alphanumeric handles; keep validation permissive but bounded. */
export function normaliseDuprId(input: string | null | undefined): string | null {
  const value = (input ?? "").trim().toUpperCase();
  if (!value) return null;
  return value.slice(0, 24);
}
