import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthUser, getUserRowByEmail, syncUserRow } from "@/lib/accounts";
import { hasSigningSecret, signToken, PLAYER_COOKIE, PLAYER_SESSION_MAX_AGE, secureCookieOptions } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, signupSchema } from "@/lib/validation";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { normaliseDuprId, skillFromDupr } from "@/lib/dupr";

export const runtime = "nodejs";

/**
 * Player signup — the account itself is created in Supabase Auth, and the
 * app-level profile (name, phone, skill, wallet) is mirrored into `users` with
 * the same id. We then mint our own session cookie so the middleware can gate
 * /dashboard without calling Supabase on every request.
 */
export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`signup:${getClientIp(req)}`, 8, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const parsed = signupSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const { full_name, email, password, phone, dupr } = parsed.data;
    // Category is derived from the rating, never self-declared.
    const skill_level = skillFromDupr(dupr);
    const dupr_id = normaliseDuprId(parsed.data.dupr_id);

    if (!hasSigningSecret()) {
      return NextResponse.json(
        { error: "Server cannot sign sessions. Set SESSION_SECRET in Vercel and redeploy." },
        { status: 500 },
      );
    }

    if (!isSupabaseAdminConfigured) {
      return NextResponse.json(
        { error: "Signups are temporarily unavailable. Please message us on WhatsApp." },
        { status: 503 },
      );
    }

    await ensureSchema();

    const existing = await getUserRowByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists. Sign in instead." },
        { status: 409 },
      );
    }

    const created = await createAuthUser({ email, password, full_name, phone, skill_level });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: created.status });
    }

    await syncUserRow({
      id: created.id,
      email,
      full_name,
      phone,
      skill_level,
      dupr_id,
      dupr: dupr ?? null,
      role: "player",
    });

    const token = await signToken({ id: created.id, email, name: full_name, role: "user" });
    (await cookies()).set(PLAYER_COOKIE, token, {
      ...secureCookieOptions,
      sameSite: "lax",
      maxAge: PLAYER_SESSION_MAX_AGE,
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
}
