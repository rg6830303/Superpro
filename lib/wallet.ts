import { query, queryOne } from "@/lib/db";

/**
 * SuperPro wallet — prepaid store credit, held in PAISE on `users`.
 *
 * Every movement is written twice: the running balance on the user row, and an
 * immutable row in `wallet_transactions`. The balance update is a single
 * conditional statement, so two concurrent debits can never both succeed
 * against the same rupee — the second one matches no row and returns null.
 */

export type WalletKind =
  | "topup"
  | "refund"
  | "adjustment"
  | "booking"
  | "order"
  | "coaching"
  | "tournament"
  | "bonus";

export type WalletTransaction = {
  id: string;
  user_id: string;
  delta_paise: number;
  balance_after_paise: number;
  kind: WalletKind;
  reason: string | null;
  ref_table: string | null;
  ref_id: string | null;
  created_by: string;
  created_at: string;
};

export async function getWalletBalance(userId: string): Promise<number> {
  const row = await queryOne<{ wallet_balance_paise: number }>(
    `SELECT wallet_balance_paise FROM users WHERE id = $1`,
    [userId],
  ).catch(() => null);
  return Number(row?.wallet_balance_paise ?? 0);
}

export type AdjustArgs = {
  userId: string;
  /** Positive to credit, negative to debit. */
  deltaPaise: number;
  kind: WalletKind;
  reason?: string;
  refTable?: string | null;
  refId?: string | null;
  /** Admin email, or "system" for automatic movements. */
  createdBy?: string;
};

export type AdjustResult =
  | { ok: true; balancePaise: number }
  | { ok: false; error: "insufficient" | "not_found" | "failed"; balancePaise: number };

/**
 * Apply a wallet movement atomically.
 *
 * The guard `wallet_balance_paise + $delta >= 0` lives inside the UPDATE, so a
 * debit larger than the balance updates zero rows instead of driving the wallet
 * negative — no read-then-write race.
 */
export async function adjustWallet(args: AdjustArgs): Promise<AdjustResult> {
  const { userId, deltaPaise, kind, reason, refTable, refId, createdBy = "system" } = args;

  if (!Number.isFinite(deltaPaise) || Math.trunc(deltaPaise) !== deltaPaise) {
    return { ok: false, error: "failed", balancePaise: 0 };
  }
  if (deltaPaise === 0) {
    return { ok: true, balancePaise: await getWalletBalance(userId) };
  }

  try {
    const rows = await query<{ wallet_balance_paise: number }>(
      `UPDATE users
       SET wallet_balance_paise = wallet_balance_paise + $1, updated_at = now()
       WHERE id = $2 AND wallet_balance_paise + $1 >= 0
       RETURNING wallet_balance_paise`,
      [deltaPaise, userId],
    );

    if (rows.length === 0) {
      const exists = await queryOne<{ wallet_balance_paise: number }>(
        `SELECT wallet_balance_paise FROM users WHERE id = $1`,
        [userId],
      );
      if (!exists) return { ok: false, error: "not_found", balancePaise: 0 };
      return { ok: false, error: "insufficient", balancePaise: Number(exists.wallet_balance_paise) };
    }

    const balance = Number(rows[0].wallet_balance_paise);

    await query(
      `INSERT INTO wallet_transactions (user_id, delta_paise, balance_after_paise, kind, reason,
         ref_table, ref_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, deltaPaise, balance, kind, reason ?? null, refTable ?? null, refId ?? null, createdBy],
    ).catch((err) => {
      // The ledger is for humans; the balance is the source of truth. A failed
      // ledger write is logged loudly but must not roll back a paid booking.
      console.error("[wallet] ledger write failed:", err instanceof Error ? err.message : err);
    });

    return { ok: true, balancePaise: balance };
  } catch (err) {
    console.error("[wallet] adjust failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "failed", balancePaise: 0 };
  }
}

export async function listWalletTransactions(userId: string, limit = 25): Promise<WalletTransaction[]> {
  return query<WalletTransaction>(
    `SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  ).catch(() => []);
}

/**
 * Charge a booking or order to the wallet. Returns null when the wallet cannot
 * cover it, so the caller can fall back to another payment method.
 */
export async function chargeWallet(args: {
  userId: string;
  amountPaise: number;
  kind: WalletKind;
  reason: string;
  refTable?: string;
  refId?: string;
}): Promise<{ ok: boolean; balancePaise: number; error?: string }> {
  const result = await adjustWallet({
    userId: args.userId,
    deltaPaise: -Math.abs(args.amountPaise),
    kind: args.kind,
    reason: args.reason,
    refTable: args.refTable ?? null,
    refId: args.refId ?? null,
    createdBy: "system",
  });

  if (result.ok) return { ok: true, balancePaise: result.balancePaise };
  return {
    ok: false,
    balancePaise: result.balancePaise,
    error:
      result.error === "insufficient"
        ? "Not enough wallet balance for this booking."
        : "Wallet could not be charged.",
  };
}
