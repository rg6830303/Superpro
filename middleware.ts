import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, ADMIN_COOKIE, PLAYER_COOKIE } from "@/lib/auth";

/**
 * One domain for everything: https://www.sparvic.com.
 *
 *   - The old Vercel addresses redirect permanently to the same page on the
 *     new domain: superpro.vercel.app → www.sparvic.com/<path>, and
 *     superproadmin.vercel.app → www.sparvic.com/admin. (The bare sparvic.com
 *     already redirects to www in the Vercel domain settings.) Preview
 *     deployments on other *.vercel.app addresses are left alone.
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

  return NextResponse.next();
}

export const config = {
  // Skip build output and static files by extension — not the /products/
  // folder as a whole, which would also skip the product pages themselves.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?)$).*)"],
};
