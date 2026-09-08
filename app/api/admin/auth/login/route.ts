import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { signToken, ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, secureCookieOptions } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Admin login resolution order:
 *   1. `admins` row matching the email (bcrypt compare)
 *   2. ADMIN_EMAIL + ADMIN_PASSWORD_HASH env bcrypt compare
 *   3. ADMIN_EMAIL + ADMIN_PASSWORD plaintext (constant-time) — bootstrap only,
 *      so the owner can still get in before the database has been seeded.
 *
 * A successful env-path login seeds the `admins` row, so step 3 stops being
 * needed after the first sign-in.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    // Deliberately tight: admin is a handful of known accounts, so a low
    // ceiling shrinks the brute-force surface to almost nothing.
    const rl = await checkRateLimit(`admin-login:${ip}`, 6, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const { email, password } = parsed.data;

    if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Server is missing SESSION_SECRET. Set it in Vercel and redeploy." },
        { status: 500 },
      );
    }

    await ensureSchema();

    let ok = false;
    let adminId = "env-admin";
    let adminName = "SuperPro Admin";
    let via: "db" | "env-hash" | "env-plain" | "none" = "none";

    const row = await queryOne<{ id: string; name: string; password_hash: string; active: boolean }>(
      `SELECT id, name, password_hash, active FROM admins WHERE email = $1 LIMIT 1`,
      [email],
    ).catch(() => null);

    if (row?.active) {
      ok = await bcrypt.compare(password, row.password_hash).catch(() => false);
      if (ok) {
        via = "db";
        adminId = row.id;
        adminName = row.name;
      }
    }

    const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!ok && envEmail && email === envEmail) {
      const envHash = process.env.ADMIN_PASSWORD_HASH?.trim();
      if (envHash) {
        ok = await bcrypt.compare(password, envHash).catch(() => false);
        if (ok) via = "env-hash";
      }
      if (!ok && process.env.ADMIN_PASSWORD) {
        const a = Buffer.from(password.trim());
        const b = Buffer.from(process.env.ADMIN_PASSWORD.trim());
        ok = a.length === b.length && timingSafeEqual(a, b);
        if (ok) via = "env-plain";
      }

      // Materialise an admins row so the console has something to manage.
      if (ok && !row) {
        const hash = process.env.ADMIN_PASSWORD_HASH?.trim() || (await bcrypt.hash(password, 12));
        const created = await query<{ id: string }>(
          `INSERT INTO admins (email, password_hash, name, role) VALUES ($1,$2,'SuperPro Owner','owner')
           ON CONFLICT (email) DO NOTHING RETURNING id`,
          [email, hash],
        ).catch(() => []);
        if (created[0]) adminId = created[0].id;
      }
    }

    console.log("[admin-login]", { email, ok, via });

    if (!ok) {
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await query(`UPDATE admins SET last_login_at = now() WHERE email = $1`, [email]).catch(() => {});

    const token = await signToken({ id: adminId, email, name: adminName, role: "admin" });
    (await cookies()).set(ADMIN_COOKIE, token, {
      ...secureCookieOptions,
      // strict: the console is never reached via a cross-site link, which fully
      // neutralises CSRF on admin actions.
      sameSite: "strict",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin-login]", err);
    return NextResponse.json({ error: "Could not sign you in." }, { status: 500 });
  }
}
