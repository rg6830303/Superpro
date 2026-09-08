import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  ensureAdminAccount,
  isAdminAccount,
  normaliseLoginEmail,
  syncUserRow,
  verifyCredentials,
} from "@/lib/accounts";
import { hasSigningSecret, signToken, ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE, secureCookieOptions } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Admin console sign-in, also backed by Supabase Auth.
 *
 * Staff type a USERNAME (e.g. "ishaanchetani"); Supabase needs an email, so a
 * bare username is expanded to <username>@ADMIN_EMAIL_DOMAIN before it is
 * verified. Two gates must both pass:
 *
 *   1. Supabase Auth accepts the password.
 *   2. The account carries an admin/staff role (app_metadata, or users.role).
 *
 * On a fresh Supabase project the configured bootstrap pair (ADMIN_USERNAME +
 * ADMIN_PASSWORD) creates the owner account on first sign-in, so the console is
 * never unreachable after a clean deploy.
 */
const schema = z.object({
  email: z.string().trim().min(3, "Enter your username").max(120),
  password: z.string().min(1, "Enter your password").max(128),
});

const BOOTSTRAP_USERNAME = (process.env.ADMIN_USERNAME ?? "ishaanchetani").trim().toLowerCase();
const BOOTSTRAP_PASSWORD = process.env.ADMIN_PASSWORD ?? "Superpro2026";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    // Deliberately tight: admin is a handful of known accounts, so a low
    // ceiling shrinks the brute-force surface to almost nothing.
    const rl = await checkRateLimit(`admin-login:${ip}`, 8, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details." }, { status: 400 });
    }

    if (!hasSigningSecret()) {
      return NextResponse.json(
        { error: "Server cannot sign sessions. Set SESSION_SECRET in Vercel and redeploy." },
        { status: 500 },
      );
    }
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
    }

    await ensureSchema();

    const submitted = parsed.data.email.trim().toLowerCase();
    const email = normaliseLoginEmail(submitted);
    const username = submitted.split("@")[0];
    const password = parsed.data.password;

    let auth = await verifyCredentials(email, password);

    // Bootstrap: the configured owner has not been created in Supabase yet.
    if (!auth.ok && username === BOOTSTRAP_USERNAME && password === BOOTSTRAP_PASSWORD) {
      const id = await ensureAdminAccount(email, password);
      if (id) auth = await verifyCredentials(email, password);
    }

    if (!auth.ok) {
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    await syncUserRow({
      id: auth.id,
      email: auth.email,
      full_name: (auth.metadata.full_name as string) ?? "SuperPro Admin",
      role: username === BOOTSTRAP_USERNAME ? "admin" : undefined,
    });

    if (!(await isAdminAccount(auth.id, auth.metadata))) {
      console.warn("[admin-login] non-admin account attempted console access:", auth.email);
      return NextResponse.json({ error: "This account cannot access the admin console." }, { status: 403 });
    }

    const token = await signToken({
      id: auth.id,
      email: auth.email,
      name: (auth.metadata.full_name as string) ?? "SuperPro Admin",
      role: "admin",
    });

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
