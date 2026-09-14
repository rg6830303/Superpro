import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";
import { reconcilePendingTopups } from "@/lib/wallet";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "I paid but my balance is wrong." Asks Razorpay what happened to this
 * player's unconfirmed top-ups and credits whatever really went through.
 *
 * Scoped to the caller's own account, so it cannot be used to poke at anyone
 * else's payments, and idempotent — the credit guard lives in the UPDATE.
 */
export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const rl = await checkRateLimit(`reconcile:${getClientIp(req)}`, 8, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many checks. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  try {
    await ensureSchema();
    const result = await reconcilePendingTopups(session.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[wallet/reconcile]", err);
    return NextResponse.json({ error: "Could not check those payments." }, { status: 500 });
  }
}
