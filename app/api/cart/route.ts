import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import type { CartLine } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The account's basket.
 *
 * One cart per player, holding both gear and court slots. It lives server-side
 * so it follows them between phone and laptop; the browser keeps a copy for
 * signed-out browsing and hands it over on sign-in.
 *
 * Prices stored here are for display only. Checkout re-prices every line from
 * the products and sessions tables before charging, so a tampered cart changes
 * what is shown and nothing that is billed.
 */

const MAX_LINES = 40;

/** Accept only the shape we wrote, and clamp anything a client could inflate. */
function sanitise(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CartLine[] = [];
  for (const item of raw.slice(0, MAX_LINES)) {
    if (!item || typeof item !== "object") continue;
    const l = item as Record<string, unknown>;
    const id = typeof l.product_id === "string" ? l.product_id : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const kind = l.kind === "slot" ? "slot" : "product";
    out.push({
      product_id: id,
      slug: String(l.slug ?? ""),
      name: String(l.name ?? "").slice(0, 160),
      price_paise: Math.max(0, Math.min(10_000_000, Math.round(Number(l.price_paise) || 0))),
      // A slot is one seat; only goods carry a quantity.
      qty: kind === "slot" ? 1 : Math.max(1, Math.min(20, Math.round(Number(l.qty) || 1))),
      image_url: typeof l.image_url === "string" ? l.image_url : null,
      kind,
      ...(kind === "slot"
        ? {
            session_id: typeof l.session_id === "string" ? l.session_id : undefined,
            session_date: typeof l.session_date === "string" ? l.session_date : undefined,
            start_time: typeof l.start_time === "string" ? l.start_time : undefined,
            end_time: typeof l.end_time === "string" ? l.end_time : undefined,
            venue_name: typeof l.venue_name === "string" ? l.venue_name : undefined,
            level: typeof l.level === "string" ? l.level : undefined,
          }
        : {}),
    });
  }
  return out;
}

export async function GET() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ lines: [], signed_in: false });
  try {
    await ensureSchema();
    const row = await queryOne<{ lines: CartLine[] }>(`SELECT lines FROM carts WHERE user_id = $1`, [session.id]);
    return NextResponse.json({ lines: sanitise(row?.lines ?? []), signed_in: true });
  } catch (err) {
    console.error("[cart:get]", err);
    return NextResponse.json({ lines: [], signed_in: true });
  }
}

export async function PUT(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in to keep a cart." }, { status: 401 });
  try {
    await ensureSchema();
    const body = (await req.json().catch(() => ({}))) as { lines?: unknown };
    const lines = sanitise(body.lines);
    await query(
      `INSERT INTO carts (user_id, lines, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET lines = EXCLUDED.lines, updated_at = now()`,
      [session.id, JSON.stringify(lines)],
    );
    return NextResponse.json({ ok: true, lines });
  } catch (err) {
    console.error("[cart:put]", err);
    return NextResponse.json({ error: "Could not save the cart." }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ ok: true });
  await query(`DELETE FROM carts WHERE user_id = $1`, [session.id]).catch(() => {});
  return NextResponse.json({ ok: true });
}
