import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError } from "@/lib/validation";
import { completePasswordReset } from "@/lib/password-reset";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

/** Finish a reset: set the new password from a valid, unused link. */
export async function POST(req: Request) {
  const rl = await checkRateLimit(`reset:${getClientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  try {
    const result = await completePasswordReset(parsed.data.token, parsed.data.password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not reset your password. Please try again." }, { status: 500 });
  }
}
