import { query, queryOne } from "@/lib/db";

export type OrderLine = { product_id: string; name: string; qty: number; price_paise: number };

/**
 * Stock is decremented when an order becomes real: immediately for cash
 * orders, and after signature verification for online ones. Failures are
 * logged rather than thrown — a stock-count hiccup must never lose a paid order.
 */
export async function decrementStock(lines: Array<{ product_id: string; qty: number }>): Promise<void> {
  for (const l of lines) {
    if (!l?.product_id || !Number.isFinite(Number(l.qty))) continue;
    await query(`UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = now() WHERE id = $2`, [
      l.qty,
      l.product_id,
    ]).catch((err) => console.error("[orders] stock update failed:", err));
  }
}

/**
 * Order lines as stored. Historic rows can hold the JSON as a string rather
 * than an array, and a string is iterable — walking it character by character
 * would fire one nonsense stock update per character, so parse defensively.
 */
export function asLines(items: unknown): OrderLine[] {
  const raw = typeof items === "string" ? safeParse(items) : items;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l) => Boolean(l) && typeof l === "object" && typeof l.product_id === "string")
    .map((l) => ({
      product_id: String(l.product_id),
      name: typeof l.name === "string" ? l.name : "Item",
      qty: Number.isFinite(Number(l.qty)) ? Number(l.qty) : 1,
      price_paise: Number.isFinite(Number(l.price_paise)) ? Number(l.price_paise) : 0,
    }));
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function fulfilOnlineOrder(orderId: string): Promise<void> {
  const order = await queryOne<{ items: unknown }>(`SELECT items FROM orders WHERE id = $1`, [orderId]);
  const lines = asLines(order?.items);
  if (lines.length > 0) await decrementStock(lines);
}
