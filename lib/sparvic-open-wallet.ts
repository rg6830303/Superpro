import { query, queryOne } from "@/lib/db";

/**
 * Take a tournament fee from the player's Sparvic Wallet, all or nothing.
 *
 * Unlike daily games, tournaments don't run on postpaid credit: the single
 * guarded UPDATE only succeeds when the balance covers the whole amount, so
 * two quick taps can never spend the same money twice or push it below zero.
 */
export async function debitForTournament(userId: string, amountPaise: number, reference: string): Promise<{ ok: true; balancePaise: number } | { ok: false; balancePaise: number }> {
  const row = await queryOne<{ wallet_balance_paise: number }>(
    `UPDATE users SET wallet_balance_paise = wallet_balance_paise - $1, updated_at = now()
     WHERE id = $2 AND wallet_balance_paise >= $1 RETURNING wallet_balance_paise`,
    [amountPaise, userId],
  );
  if (!row) {
    const cur = await queryOne<{ wallet_balance_paise: number }>(`SELECT wallet_balance_paise FROM users WHERE id = $1`, [userId]);
    return { ok: false, balancePaise: Number(cur?.wallet_balance_paise ?? 0) };
  }
  const balance = Number(row.wallet_balance_paise);
  await query(
    `INSERT INTO wallet_transactions (user_id, delta_paise, balance_after_paise, kind, reason, ref_table, ref_id, created_by)
     VALUES ($1, $2, $3, 'tournament', $4, 'open_entries', NULL, 'system')`,
    [userId, -amountPaise, balance, `Sparvic Open entry ${reference}`],
  ).catch((err) => console.error("[sparvic-open wallet] ledger write failed:", err));
  return { ok: true, balancePaise: balance };
}

/** Put the money back if the entry could not be saved after the debit. */
export async function refundTournament(userId: string, amountPaise: number, reference: string): Promise<void> {
  const row = await queryOne<{ wallet_balance_paise: number }>(
    `UPDATE users SET wallet_balance_paise = wallet_balance_paise + $1, updated_at = now() WHERE id = $2 RETURNING wallet_balance_paise`,
    [amountPaise, userId],
  );
  await query(
    `INSERT INTO wallet_transactions (user_id, delta_paise, balance_after_paise, kind, reason, ref_table, ref_id, created_by)
     VALUES ($1, $2, $3, 'refund', $4, 'open_entries', NULL, 'system')`,
    [userId, amountPaise, Number(row?.wallet_balance_paise ?? 0), `Refund: Sparvic Open entry ${reference} not saved`],
  ).catch(() => {});
}
