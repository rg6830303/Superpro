import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { hasSigningSecret } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { findRosterCoach, hashPassword, normaliseEmail, startCoachSession } from "@/lib/coach-auth";
import { recordAccountEvent } from "@/lib/activity";

export const runtime = "nodejs";

const body = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

/**
 * Coach sign-up.
 *
 * Only for an email already on a coach's profile in the admin console. A coach
 * login reads client phone numbers and emails, so "anyone can register as a
 * coach" is not an option; the club decides who is a coach, and the coach
 * sets their own password.
 */
export async function POST(req: Request) {
  const rl = await checkRateLimit(`coach-signup:${getClientIp(req)}`, 6, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  }
  if (!hasSigningSecret()) {
    return NextResponse.json({ error: "Sign-ups are unavailable right now." }, { status: 500 });
  }

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });
  }
  const email = normaliseEmail(parsed.data.email);

  await ensureSchema();
  const coach = await findRosterCoach(email);
  if (!coach || !coach.active) {
    return NextResponse.json(
      {
        error:
          "That email isn't on a SuperPro coach profile. Ask the club to add it to your profile, then sign up again.",
      },
      { status: 403 },
    );
  }
  if (coach.has_login) {
    return NextResponse.json({ error: "This coach already has a login. Sign in instead." }, { status: 409 });
  }

  const hash = await hashPassword(parsed.data.password);
  // ON CONFLICT covers two sign-ups racing for the same coach: exactly one wins.
  const rows = await query<{ id: string }>(
    `INSERT INTO coach_accounts (coach_id, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING RETURNING id`,
    [coach.id, email, hash],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "This coach already has a login. Sign in instead." }, { status: 409 });
  }

  await startCoachSession({ id: rows[0].id, coach_id: coach.id, email, name: coach.name });
  await recordAccountEvent({ req, actorType: "coach", actorId: coach.id, email, name: coach.name, kind: "signup" });
  return NextResponse.json({ ok: true, name: coach.name });
}
