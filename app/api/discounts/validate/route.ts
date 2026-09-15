import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";
import { quote } from "@/lib/discounts";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(1).max(32),
  scope: z.enum(["shop", "games", "coaching", "tournaments"]),
  subtotal_paise: z.number().int().min(0).max(100000000),
});

/**
 * Check a code as the customer types it. Quoting only — nothing is consumed
 * here, and the real discount is recomputed server-side at checkout, so a
 * stale or tampered quote cannot turn into money off.
 *
 * Rate limited, or this endpoint becomes a way to brute-force the code space
 * looking for a live one.
 */
export async function POST(req: Request) {
  const rl = await checkRateLimit(`discount:${getClientIp(req)}`, 20, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await ensureSchema();
    const session = await getPlayerSession();
    const result = await quote({
      code: parsed.data.code,
      scope: parsed.data.scope,
      subtotalPaise: parsed.data.subtotal_paise,
      userId: session?.id ?? null,
    });

    // A wrong code is a normal outcome, not a transport failure — 200 with a
    // reason, so the checkout can say why rather than "something went wrong".
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error });

    return NextResponse.json({
      ok: true,
      code: result.code.code,
      label: result.label,
      description: result.code.description,
      discount_paise: result.discountPaise,
      net_paise: result.netPaise,
    });
  } catch (err) {
    console.error("[discounts/validate]", err);
    return NextResponse.json({ error: "Could not check that code." }, { status: 500 });
  }
}
