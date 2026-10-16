import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, ADMIN_COOKIE, PLAYER_COOKIE } from "@/lib/auth";
import { isMainPath, surfaceOfHost, isMainClosedApi, isLaunched, MAIN_URL, DEMO_URL } from "@/lib/surface";

/**
 * One domain for everything: https://www.sparvic.com.
 *
 *   - The old Vercel addresses redirect permanently to the same page on the
 *     new domain: superpro.vercel.app → www.sparvic.com/<path>, and
 *     superproadmin.vercel.app → www.sparvic.com/admin. (The bare sparvic.com
 *     already redirects to www in the Vercel domain settings.) Preview
 *     deployments on other *.vercel.app addresses are left alone.
 *
 *   - Two faces, one deployment (see lib/surface.ts). www.sparvic.com is the
 *     launch: "/" is the intro film and the coming-soon page, plus sign-up,
 *     sign-in, the community, profiles and the player dashboard. Everything
 *     else goes back to "/" — nothing on the main domain leads to the demo,
 *     sparvicdemo.vercel.app, a standalone copy reachable only by its own link
 *     (it never sends visitors to the main domain). Redirects are 307 (temporary) so browsers do
 *     not cache them for good while the launch plan may still change. The
 *     demo is kept out of search results.
 *
 *   - The admin console lives at /admin on the main domain. It is not linked
 *     from anywhere on the site, every admin response carries a noindex
 *     header so search engines never list it, and every page but the sign-in
 *     form needs an admin session. It is deliberately NOT named in robots.txt:
 *     a "Disallow: /admin" line would advertise exactly where it is.
 */
const CANONICAL_HOST = (process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "www.sparvic.com").toLowerCase();
const LEGACY_SITE_HOSTS = new Set(["superpro.vercel.app"]);
const LEGACY_ADMIN_HOSTS = new Set(["superproadmin.vercel.app"]);

function hostOf(req: NextRequest): string {
  return (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
}

function toCanonical(req: NextRequest, pathname: string): NextResponse {
  const dest = new URL(`https://${CANONICAL_HOST}`);
  dest.pathname = pathname;
  dest.search = req.nextUrl.search;
  // 308 keeps the method, so a form or API POST that arrives at the old
  // address is replayed at the new one rather than turned into a GET.
  return NextResponse.redirect(dest, 308);
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  return Boolean(payload && payload.role === "admin");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = hostOf(req);

  // ── Old addresses → the new domain ─────────────────────────────────────
  if (LEGACY_ADMIN_HOSTS.has(host)) {
    return toCanonical(req, pathname.startsWith("/admin") || pathname.startsWith("/api/admin") ? pathname : "/admin");
  }
  if (LEGACY_SITE_HOSTS.has(host)) {
    return toCanonical(req, pathname);
  }

  // ── Main domain / demo split ───────────────────────────────────────────
  // API routes are shared by both faces and never redirected.
  const surface = surfaceOfHost(host);
  const isApi = pathname.startsWith("/api/");
  if (isApi && MUTATING.has(req.method)) {
    // Cross-site requests: a browser sends Origin on every POST/PATCH/DELETE.
    // Anything from another site is refused, so a malicious page can't act
    // with a signed-in player's cookies. Server-to-server calls send no Origin.
    const origin = req.headers.get("origin");
    if (origin && !sameSite(origin, host)) {
      return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
    }
    // A coarse per-address ceiling on writes, ahead of the per-endpoint limits.
    const ip = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!writeBudget(ip)) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": "60" } });
    }
  }
  if (surface === "main" && isApi && isMainClosedApi(pathname)) {
    return NextResponse.json(
      { error: "Bookings and the shop open at launch. For now, build your profile and find players to follow." },
      { status: 403 },
    );
  }
  if (surface === "main" && !isApi) {
    if (pathname === "/launch") return NextResponse.redirect(new URL(`/${req.nextUrl.search}`, req.url), 307);
    // Hidden sections are not reachable from here at all: no hop to the demo host.
    if (!isMainPath(pathname)) return NextResponse.redirect(new URL("/", req.url), 307);
    if (pathname === "/") return NextResponse.rewrite(new URL(`/launch${req.nextUrl.search}`, req.url));
  }
  if (pathname === "/launch" && isLaunched()) return NextResponse.redirect(new URL("/", req.url), 308);
  // After launch the demo's pages live on the main domain: send visitors to the
  // same path there. APIs stay answering, so tabs left open can still finish.
  if (surface === "demo" && !isApi && isLaunched()) {
    return NextResponse.redirect(new URL(`${pathname}${req.nextUrl.search}`, MAIN_URL), 308);
  }
  // The demo stands alone: it serves its own sign-up, community, profiles and
  // account pages and never hands visitors to the main domain. The one
  // exception is the admin console, which lives on the main domain only.
  if (surface === "demo" && (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/"))) {
    return isApi
      ? NextResponse.json({ error: "Not found." }, { status: 404 })
      : NextResponse.redirect(new URL("/", req.url), 307);
  }

  const res = await gate(req, pathname);
  if (surface === "demo") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const TRUSTED_HOSTS = new Set(["www.sparvic.com", "sparvic.com", new URL(DEMO_URL).hostname, "localhost", "127.0.0.1"]);

/** The Origin is this site (same host, or one of Sparvic's own domains). */
function sameSite(origin: string, host: string): boolean {
  try {
    const o = new URL(origin).hostname.toLowerCase();
    return o === host.split(":")[0].toLowerCase() || TRUSTED_HOSTS.has(o);
  } catch {
    return false;
  }
}

/** 120 write requests per minute per address, per instance (edge memory). */
const writes = new Map<string, { n: number; t: number }>();
function writeBudget(ip: string): boolean {
  const now = Date.now();
  const w = writes.get(ip);
  if (!w || now - w.t > 60_000) {
    writes.set(ip, { n: 1, t: now });
    if (writes.size > 10_000) writes.clear();
    return true;
  }
  w.n++;
  return w.n <= 120;
}

/** Admin console and player dashboard sign-in gates. */
async function gate(req: NextRequest, pathname: string): Promise<NextResponse> {
  // ── Admin console ──────────────────────────────────────────────────────
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (isAdminPage || isAdminApi) {
    if (isAdminPage && !pathname.startsWith("/admin/login") && !pathname.includes(".") && !(await isAdmin(req))) {
      const login = new URL("/admin/login", req.url);
      const res = NextResponse.redirect(login);
      res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      return res;
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  }

  // ── Player dashboard ───────────────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get(PLAYER_COOKIE)?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== "user") {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url));
    }
  }

  // Pages read this to tell the clubhouse (/dashboard/*, where booking happens)
  // from the website (view-only). Set here, never trusted from the client.
  const forwarded = new Headers(req.headers);
  forwarded.set("x-sp-path", pathname);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  // Skip build output and static files by extension — not the /products/
  // folder as a whole, which would also skip the product pages themselves.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?)$).*)"],
};
