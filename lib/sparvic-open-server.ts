import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import type { EntryInput } from "@/lib/sparvic-open";

export type OpenEntry = {
  id: string;
  reference: string;
  user_id: string;
  player_name: string;
  player_phone: string | null;
  player_email: string | null;
  player_dupr: number | null;
  player_gender: string | null;
  categories: EntryInput[];
  amount_paise: number;
  payment_status: "pending" | "paid";
  razorpay_order_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export const newReference = () => `SO-${randomBytes(4).toString("hex").toUpperCase()}`;

export function myEntries(userId: string): Promise<OpenEntry[]> {
  return query<OpenEntry>(`SELECT * FROM open_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]).catch(() => []);
}

/** Categories this player already holds a paid entry in. */
export async function paidCategories(userId: string): Promise<Set<string>> {
  const rows = await myEntries(userId);
  return new Set(rows.filter((r) => r.payment_status === "paid").flatMap((r) => r.categories.map((c) => c.category)));
}

/** Marks an entry paid only when the Razorpay order is the one we created for it. */
export function markOpenEntryPaid(reference: string, orderId: string, paymentId: string): Promise<OpenEntry | null> {
  return queryOne<OpenEntry>(
    `UPDATE open_entries SET payment_status = 'paid', razorpay_payment_id = $3, paid_at = COALESCE(paid_at, now())
     WHERE reference = $1 AND razorpay_order_id = $2 RETURNING *`,
    [reference, orderId, paymentId],
  );
}
