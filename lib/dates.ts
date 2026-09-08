/**
 * All club scheduling is in IST regardless of where the lambda runs, so every
 * "today" and week boundary is computed against Asia/Kolkata rather than UTC.
 */
export const IST_TZ = "Asia/Kolkata";

/** YYYY-MM-DD for "now" in IST. */
export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(new Date());
}

/** Add days to a YYYY-MM-DD string without tripping over DST or local time. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** The next `count` dates starting today — the week the player picks from. */
export function upcomingDates(count = 7, from: string = istToday()): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

export function dayName(isoDate: string, style: "short" | "long" = "short"): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { weekday: style, timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "Mon, 14 Sep" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "14 September 2026" */
export function formatDateLong(isoDate: string | null): string {
  if (!isoDate) return "Date TBA";
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "10–11 Jul 2026" or a single date when there's no end. */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Dates to be announced";
  if (!end || end === start) return formatDateLong(start);
  const s = start.slice(0, 10).split("-").map(Number);
  const e = end.slice(0, 10).split("-").map(Number);
  const sameMonth = s[0] === e[0] && s[1] === e[1];
  const fmt = (parts: number[], opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(
      new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])),
    );
  return sameMonth
    ? `${s[2]}–${fmt(e, { day: "numeric", month: "short", year: "numeric" })}`
    : `${fmt(s, { day: "numeric", month: "short" })} – ${fmt(e, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** "7:00 AM" from "07:00". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** True when the slot has already started in IST — used to grey out today's past slots. */
export function isPast(isoDate: string, startTime: string): boolean {
  const nowParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => nowParts.find((p) => p.type === t)?.value ?? "00";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  if (isoDate < today) return true;
  if (isoDate > today) return false;
  return startTime <= `${get("hour")}:${get("minute")}`;
}
