import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { signToken, PLAYER_COOKIE, PLAYER_SESSION_MAX_AGE, secureCookieOptions } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

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

    await ensureSchema();

    const user = await queryOne<{ id: string; email: string; full_name: string; password_hash: string }>(
      "SELECT id, email, full_name, password_hash FROM users WHERE email = $1 LIMIT 1",
      [email],
    );

    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !ok) {
      // Fixed delay blunts credential stuffing and hides "no such user" timing.
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await signToken({ id: user.id, email: user.email, name: user.full_name, role: "user" });
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
