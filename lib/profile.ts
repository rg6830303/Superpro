/** Profile helpers shared by signup, the profile page and public player pages. */

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
] as const;

/**
 * Age is derived from date of birth, never stored. A stored age is wrong within
 * a year of being entered, and the club uses it for age-category draws where
 * being wrong matters.
 */
export function ageFrom(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - d.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** Given an age in years, approximate date of birth for age-category draws. */
export function dobFromAge(age: number): string {
  const currentYear = new Date().getFullYear();
  const birthYear = Math.max(1900, currentYear - Math.round(age));
  return `${birthYear}-06-15`;
}

/** A stable, readable handle for a player's public page. */
export function handleFrom(name: string, salt: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${base || "player"}-${salt.slice(0, 4)}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
