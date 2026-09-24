import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkDecoy, checkPassword, findCoachAccount, normaliseEmail, startCoachSession } from "@/lib/coach-auth";

export const runtime = "nodejs";

const body = z.object({ email: z.string().trim().min(3), password: z.string().min(1).max(128) });

/** One message for every failure, so the form never confirms which emails are coaches. */
const NOPE = "That email and password don't match a coach login.";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`coach-login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  }
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: NOPE }, { status: 401 });

  await ensureSchema();
  const email = normaliseEmail(parsed.data.email);
  const account = await findCoachAccount(email);
  if (!account) {
    await checkDecoy(parsed.data.password);
    return NextResponse.json({ error: NOPE }, { status: 401 });
  }
  if (!(await checkPassword(parsed.data.password, account.password_hash))) {
    return NextResponse.json({ error: NOPE }, { status: 401 });
  }
  // A coach the club has delisted keeps their account but cannot sign in.
  if (!account.active) {
    return NextResponse.json({ error: "This coach profile is not active. Contact the club." }, { status: 403 });
  }

  await startCoachSession(account);
  return NextResponse.json({ ok: true, name: account.name });
}
