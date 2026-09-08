import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, ADMIN_COOKIE, PLAYER_COOKIE } from "@/lib/auth";

/**
 * Domain separation between User Website (superpro.vercel.app) and Admin Console (superproadmin.vercel.app).
 *
 *   - Admin host (e.g. superproadmin.vercel.app or configured NEXT_PUBLIC_ADMIN_HOST):
 *     Only serves /admin and /api/admin. Any public site path (e.g. "/", "/products")
 *     automatically redirects to /admin console. Every response is tagged X-Robots-Tag: noindex.
 *
 *   - User site host (e.g. superpro.vercel.app):
 *     Serves the main customer website. Any attempt to access /admin or /admin/* is
 *     domain-separated and returns a 404 Not Found so the admin console is completely hidden.
 *
 *   - Local dev (localhost):
 *     Allows access to both surfaces on single origin when NEXT_PUBLIC_ADMIN_HOST is unset.
 */
const CONFIG_ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST?.trim().toLowerCase();

const PUBLIC_ASSET = /\.(png|jpg|jpeg|gif|svg|ico|webp|json|txt|xml|webmanifest|css|js)$/i;

function hostOf(req: NextRequest): string {
  return (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
}

function checkAdminHost(host: string): boolean {
  if (!host) return false;
  if (CONFIG_ADMIN_HOST && host === CONFIG_ADMIN_HOST) return true;
  if (host === "superproadmin.vercel.app") return true;
  if (host.startsWith("admin.") || host.startsWith("superproadmin.")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = hostOf(req);
  const isDev = process.env.NODE_ENV === "development" && host.includes("localhost");

  const onAdminHost = checkAdminHost(host);
  const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (onAdminHost) {
    // Any non-admin path on the dedicated admin domain goes straight to /admin console
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

    // Gate the admin console. /admin/login stays accessible.
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

  // On non-admin host (e.g. superpro.vercel.app / public site):
  if (isAdminPath) {
    if (!isDev) {
      // Completely hide /admin on the public domain with a 404
      return new NextResponse(null, {
        status: 404,
        headers: { "X-Robots-Tag": "noindex, nofollow" },
      });
    }

    // Single-domain local dev fallback
    if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !pathname.includes(".")) {
      const token = req.cookies.get(ADMIN_COOKIE)?.value;
      const payload = token ? await verifyToken(token) : null;
      if (!payload || payload.role !== "admin") {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }
  }

  // Player dashboard gate
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
