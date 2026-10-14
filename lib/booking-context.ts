import { headers } from "next/headers";

/**
 * True when the page is being served inside the member clubhouse
 * (/dashboard/...). Booking and payments happen only there; the same page on
 * the public website is view-only (the shop is the one exception).
 */
export async function inClubhouse(): Promise<boolean> {
  return ((await headers()).get("x-sp-path") ?? "").startsWith("/dashboard");
}
