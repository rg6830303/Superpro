import { query, queryOne } from "@/lib/db";

export type OrderLine = { product_id: string; name: string; qty: number; price_paise: number };

/**
 * Stock is decremented when an order becomes real: immediately for cash
 * orders, and after signature verification for online ones. Failures are
 * logged rather than thrown — a stock-count hiccup must never lose a paid order.
 */
export async function decrementStock(lines: Array<{ product_id: string; qty: number }>): Promise<void> {
  for (const l of lines) {
    await query(`UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = now() WHERE id = $2`, [
      l.qty,
      l.product_id,
    ]).catch((err) => console.error("[orders] stock update failed:", err));
  }
}

export async function fulfilOnlineOrder(orderId: string): Promise<void> {
  const order = await queryOne<{ items: Array<{ product_id: string; qty: number }> }>(
    `SELECT items FROM orders WHERE id = $1`,
    [orderId],
  );
  if (order?.items) await decrementStock(order.items);
}
