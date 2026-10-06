import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { emailSchema, formatZodError } from "@/lib/validation";
import { requestPasswordReset } from "@/lib/password-reset";
import { DEMO_URL, MAIN_URL, surfaceOfHost } from "@/lib/surface";

export const runtime = "nodejs";

const schema = z.object({ email: emailSchema });

/**
 * Forgot password: emails a one-hour, single-use reset link — only to an email
 * that is registered (users row + Supabase Auth account). Unregistered emails
 * get a clear "no account" answer and no email. Rate limited per IP and per
 * address, which also caps how fast anyone could probe for registered emails.
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

  // The link goes back to the site the player asked from — the demo and the
  // main domain are separate — and never to an arbitrary Host header.
  const surface = surfaceOfHost(req.headers.get("host"));
  const origin = !process.env.VERCEL ? new URL(req.url).origin : surface === "demo" ? DEMO_URL : MAIN_URL;

  try {
    // Per-address limit as well, so one inbox cannot be flooded from many IPs.
    const perEmail = await checkRateLimit(`forgot-email:${parsed.data.email}`, 3, 60 * 60 * 1000);
    if (!perEmail.ok) {
      return NextResponse.json(
        { error: "A reset link was sent to this email recently. Check your inbox (and spam), or try again in an hour." },
        { status: 429 },
      );
    }
    const result = await requestPasswordReset(parsed.data.email, origin);
    if (result === "not_registered") {
      return NextResponse.json(
        { error: "We couldn't find a Sparvic account with that email. Check the spelling, or register a new account.", code: "not_registered" },
        { status: 404 },
      );
    }
    if (result === "send_failed") {
      return NextResponse.json(
        { error: "We couldn't send the email just now. Please try again in a minute, or message us on WhatsApp." },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
