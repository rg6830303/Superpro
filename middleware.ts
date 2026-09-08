import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, ADMIN_COOKIE, PLAYER_COOKIE } from "@/lib/auth";

/**
 * Host-based separation between the two Vercel deployments.
 *
 *   - NEXT_PUBLIC_ADMIN_HOST (e.g. superpro-admin.vercel.app) is the ONLY host
 *     where /admin is reachable. On that host "/" and any public path redirect
 *     straight to the console, so a customer who finds the URL never sees the
 *     shop, and every response is tagged noindex.
 *   - Every other host serves the public site and 404s /admin, so the console is
 *     invisible from the customer domain.
 *
 * With NEXT_PUBLIC_ADMIN_HOST unset (local dev) both surfaces share one origin.
 */
const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST?.trim().toLowerCase();

const PUBLIC_ASSET = /\.(png|jpg|jpeg|gif|svg|ico|webp|json|txt|xml|webmanifest)$/i;

function hostOf(req: NextRequest): string {
  return (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = hostOf(req);
  const onAdminHost = Boolean(ADMIN_HOST) && host === ADMIN_HOST;
  const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (onAdminHost) {
    // Any non-admin page on the admin host goes to the console.
    if (
      !isAdminPath &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/_next/") &&
      !pathname.startsWith("/icons/") &&
      !pathname.startsWith("/logo/") &&
      !PUBLIC_ASSET.test(pathname)
    ) {
      const dest = req.nextUrl.clone();
      dest.pathname = "/admin";
      dest.search = "";
      return NextResponse.redirect(dest);
    }

    // Gate the console itself. Login page and asset-like paths stay open.
    if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !pathname.includes(".")) {
      const token = req.cookies.get(ADMIN_COOKIE)?.value;
      const payload = token ? await verifyToken(token) : null;
      if (!payload || payload.role !== "admin") {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }

    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  }

  if (isAdminPath) {
    if (ADMIN_HOST) {
      // A dedicated admin host exists and this isn't it — the console is fully
      // removed from the public domain.
      return new NextResponse(null, {
        status: 404,
        headers: { "X-Robots-Tag": "noindex, nofollow" },
      });
    }
    // Single-domain (local dev): still gate the console.
    if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !pathname.includes(".")) {
      const token = req.cookies.get(ADMIN_COOKIE)?.value;
      const payload = token ? await verifyToken(token) : null;
      if (!payload || payload.role !== "admin") {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }
  }

  // Player dashboard gate.
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|logo/|products/|robots.txt|sitemap.xml).*)"],
};
