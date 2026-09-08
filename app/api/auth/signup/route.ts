import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { signToken, PLAYER_COOKIE, PLAYER_SESSION_MAX_AGE, secureCookieOptions } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, signupSchema } from "@/lib/validation";

export const runtime = "nodejs";

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
    const { full_name, email, password, phone, skill_level } = parsed.data;

    await ensureSchema();

    const existing = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists. Sign in instead." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, phone, skill_level)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [email, passwordHash, full_name, phone, skill_level],
    );
    const user = rows[0];

    const token = await signToken({ id: user.id, email, name: full_name, role: "user" });
    (await cookies()).set(PLAYER_COOKIE, token, {
      ...secureCookieOptions,
      sameSite: "lax",
      maxAge: PLAYER_SESSION_MAX_AGE,
    });

    return NextResponse.json({ ok: true, id: user.id });
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
}
