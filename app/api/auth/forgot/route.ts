import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { emailSchema, formatZodError } from "@/lib/validation";
import { requestPasswordReset } from "@/lib/password-reset";
import { MAIN_URL } from "@/lib/surface";

export const runtime = "nodejs";

const schema = z.object({ email: emailSchema });

/**
 * Forgot password: emails a one-hour reset link. The answer is the same whether
 * or not the address has an account, so this cannot be used to probe who has
 * registered.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  // Links always point at the live domain in production; locally, at whatever
  // origin is being tested.
  const origin = process.env.VERCEL ? MAIN_URL : new URL(req.url).origin;

  try {
    // Per-address limit as well, so one inbox cannot be flooded from many IPs.
    const perEmail = await checkRateLimit(`forgot-email:${parsed.data.email}`, 3, 60 * 60 * 1000);
    if (perEmail.ok) await requestPasswordReset(parsed.data.email, origin);
  } catch (err) {
    console.error("[forgot] failed:", err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true });
}
