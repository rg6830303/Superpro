import { query, queryOne } from "@/lib/db";
import { WALLET_FLOOR_PAISE } from "@/lib/postpaid";

// Re-exported so server callers can keep importing everything from one place.
export { WALLET_FLOOR_PAISE, canSpend, duesPaise, isBlocked } from "@/lib/postpaid";
import { capturedPayment, fetchOrderPayments, isRazorpayEnabled } from "@/lib/razorpay";

/**
 * Sparvic wallet — prepaid store credit, held in PAISE on `users`.
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
       WHERE id = $2 AND wallet_balance_paise + $1 >= $3
       RETURNING wallet_balance_paise`,
      [deltaPaise, userId, WALLET_FLOOR_PAISE],
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

export type ReconcileResult = { checked: number; credited: number; creditedPaise: number };

/**
 * Settle top-ups that were paid but never confirmed back to us.
 *
 * A player can pay and immediately close the tab, drop off the network, or hit
 * a failed verify request. Razorpay has their money and our ledger row is still
 * `pending`, so the wallet is short. This asks Razorpay what happened to each
 * pending order and credits the ones that were actually captured.
 *
 * Safe to call as often as you like: crediting goes through the same
 * `pending -> paid` UPDATE guard as the callback path, so a row can only ever
 * be credited once no matter how many callers race here.
 */
export async function reconcilePendingTopups(userId?: string): Promise<ReconcileResult> {
  const result: ReconcileResult = { checked: 0, credited: 0, creditedPaise: 0 };
  if (!isRazorpayEnabled) return result;

  // Only rows old enough that the gateway has settled, and young enough to
  // still be worth chasing. A minute of grace keeps this off the happy path,
  // where the callback is about to do the job anyway.
  const pending = await query<{ id: string; user_id: string; amount_paise: number; reference: string; razorpay_order_id: string }>(
    `SELECT id, user_id, amount_paise, reference, razorpay_order_id
     FROM wallet_topups
     WHERE status = 'pending'
       AND razorpay_order_id IS NOT NULL
       AND created_at < now() - interval '1 minute'
       AND created_at > now() - interval '7 days'
       ${userId ? "AND user_id = $1" : ""}
     ORDER BY created_at
     LIMIT 25`,
    userId ? [userId] : [],
  ).catch(() => []);

  for (const row of pending) {
    result.checked += 1;
    let captured;
    try {
      captured = capturedPayment(await fetchOrderPayments(row.razorpay_order_id));
    } catch (err) {
      console.error("[wallet] reconcile lookup failed:", err instanceof Error ? err.message : err);
      continue;
    }
    if (!captured) continue;

    // Never credit more than the order was for, whatever the gateway reports.
    const amount = Math.min(row.amount_paise, captured.amount);

    const claimed = await query<{ id: string }>(
      `UPDATE wallet_topups
       SET status = 'paid', razorpay_payment_id = $1, credited_at = now()
       WHERE id = $2 AND status = 'pending'
       RETURNING id`,
      [captured.id, row.id],
    );
    if (claimed.length === 0) continue;

    const credit = await adjustWallet({
      userId: row.user_id,
      deltaPaise: amount,
      kind: "topup",
      reason: `Online top-up ${row.reference} (reconciled)`,
      refTable: "wallet_topups",
      refId: row.id,
      createdBy: "razorpay-reconcile",
    });
    if (credit.ok) {
      result.credited += 1;
      result.creditedPaise += amount;
    }
  }

  return result;
}
