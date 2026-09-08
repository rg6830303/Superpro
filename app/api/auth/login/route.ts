import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { syncUserRow, verifyCredentials } from "@/lib/accounts";
import { signToken, PLAYER_COOKIE, PLAYER_SESSION_MAX_AGE, secureCookieOptions } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, loginSchema } from "@/lib/validation";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

/** Player sign-in. Credentials are checked by Supabase Auth, never here. */
export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`login:${getClientIp(req)}`, 10, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const parsed = loginSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const { email, password } = parsed.data;

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
    }

    const auth = await verifyCredentials(email, password);
    if (!auth.ok) {
      // Fixed delay blunts credential stuffing and hides "no such user" timing.
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await ensureSchema();
    const row = await syncUserRow({
      id: auth.id,
      email: auth.email,
      full_name: (auth.metadata.full_name as string) ?? null,
      phone: (auth.metadata.phone as string) ?? null,
      skill_level: (auth.metadata.skill_level as string) ?? null,
    });

    const name = row?.full_name ?? (auth.metadata.full_name as string) ?? auth.email.split("@")[0];
    const token = await signToken({ id: auth.id, email: auth.email, name, role: "user" });
    (await cookies()).set(PLAYER_COOKIE, token, {
      ...secureCookieOptions,
      sameSite: "lax",
      maxAge: PLAYER_SESSION_MAX_AGE,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Could not sign you in. Please try again." }, { status: 500 });
  }
}
