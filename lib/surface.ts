/**
 * Two faces of one deployment.
 *
 *   main — www.sparvic.com. The launch: the intro film, the coming-soon page,
 *          and everything a player needs to register and find each other —
 *          sign-up and sign-in, the community directory, player profiles and
 *          following, and their own dashboard. The admin and coach portals
 *          live here too; they are staff tools, not site content.
 *
 *   demo — sparvicdemo.vercel.app. The full site, standalone and unlinked:
 *          homepage, shop, daily games, coaching, tournaments, medical,
 *          about, plus its own sign-up, community and profiles. It never
 *          sends anyone to the main domain (the admin console stays there).
 *
 *   full — anything else (localhost, preview deployments): everything served,
 *          nothing redirected, so work in progress can be looked at whole.
 */

export type Surface = "main" | "demo" | "full";

export const MAIN_URL = "https://www.sparvic.com";
export const DEMO_URL = (process.env.NEXT_PUBLIC_DEMO_URL ?? "https://sparvicdemo.vercel.app").replace(/\/+$/, "");

const MAIN_HOSTS = new Set(["www.sparvic.com", "sparvic.com"]);
const DEMO_HOSTS = new Set([new URL(DEMO_URL).hostname]);

export function surfaceOfHost(host: string | null | undefined): Surface {
  const h = (host ?? "").split(":")[0].toLowerCase();
  if (MAIN_HOSTS.has(h)) return "main";
  if (DEMO_HOSTS.has(h)) return "demo";
  return "full";
}

/**
 * Paths that belong to the main domain. Matched as a prefix on a segment
 * boundary, so "/players" covers "/players/some-handle" but not "/playersx".
 */
const MAIN_PREFIXES = [
  "/launch",
  "/signup",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/players",
  "/dashboard",
  "/assessment",
  "/admin",
];

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Served by the main domain (the home page there is the coming-soon page). */
export function isMainPath(pathname: string): boolean {
  return pathname === "/" || MAIN_PREFIXES.some((p) => underPrefix(pathname, p));
}


/**
 * Booking, shop and wallet APIs. Closed on the main domain during the launch:
 * a signed-in player there can build a profile, discover others and follow
 * them — nothing that takes a booking or money. (Payment webhooks and cron
 * live elsewhere and stay open.)
 */
const MAIN_CLOSED_API = [
  "/api/coach",
  "/api/cart",
  "/api/checkout",
  "/api/coaching",
  "/api/discounts",
  "/api/games",
  "/api/orders",
  "/api/tournaments",
  "/api/wallet",
];

export function isMainClosedApi(pathname: string): boolean {
  return MAIN_CLOSED_API.some((p) => underPrefix(pathname, p));
}
