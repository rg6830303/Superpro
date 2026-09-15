import { query, queryOne } from "@/lib/db";

/**
 * Discount codes.
 *
 * Two rules carry the weight here. First, the value is always computed on the
 * server from the code row — a client that sends its own discount is ignored.
 * Second, the usage cap is claimed with a conditional UPDATE rather than a
 * read-then-write, so a code limited to 50 uses cannot be redeemed 60 times by
 * 60 people arriving at once.
 */

export type DiscountScope = "shop" | "games" | "coaching" | "tournaments";

export type DiscountCode = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "amount";
  percent_off: number | null;
  amount_off_paise: number | null;
  max_discount_paise: number | null;
  min_spend_paise: number;
  max_uses: number | null;
  used_count: number;
  per_user_limit: number | null;
  scopes: DiscountScope[];
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
};

export type DiscountQuote =
  | { ok: true; code: DiscountCode; discountPaise: number; netPaise: number; label: string }
  | { ok: false; error: string };

/** Codes are case- and space-insensitive; people retype them off a poster. */
export function normaliseCode(input: string): string {
  return input.trim().replace(/\s+/g, "").toUpperCase().slice(0, 32);
}

export async function findCode(code: string): Promise<DiscountCode | null> {
  return queryOne<DiscountCode>(
    `SELECT id, code, description, kind, percent_off, amount_off_paise, max_discount_paise,
            min_spend_paise, max_uses, used_count, per_user_limit, scopes,
            starts_at::text AS starts_at, expires_at::text AS expires_at, active
     FROM discount_codes WHERE upper(code) = $1 LIMIT 1`,
    [normaliseCode(code)],
  ).catch(() => null);
}

/** What this code is worth on this basket. Never trusts a client-sent amount. */
export function valueOf(code: DiscountCode, subtotalPaise: number): number {
  const raw =
    code.kind === "percent"
      ? Math.round((subtotalPaise * Number(code.percent_off ?? 0)) / 100)
      : Number(code.amount_off_paise ?? 0);

  const capped = code.max_discount_paise != null ? Math.min(raw, code.max_discount_paise) : raw;
  // A discount can never exceed the basket, or turn into a payout.
  return Math.max(0, Math.min(capped, subtotalPaise));
}

export function describe(code: DiscountCode): string {
  return code.kind === "percent"
    ? `${Number(code.percent_off)}% off`
    : `₹${Math.round(Number(code.amount_off_paise) / 100).toLocaleString("en-IN")} off`;
}

/**
 * Check a code without consuming it — what the checkout calls as the customer
 * types. Every reason for refusal is spelled out, because "invalid code" when
 * the real problem is a minimum spend is a support ticket.
 */
export async function quote(args: {
  code: string;
  scope: DiscountScope;
  subtotalPaise: number;
  userId?: string | null;
}): Promise<DiscountQuote> {
  const entered = normaliseCode(args.code);
  if (!entered) return { ok: false, error: "Enter a code." };

  const code = await findCode(entered);
  if (!code) return { ok: false, error: "That code does not exist." };
  if (!code.active) return { ok: false, error: "That code is no longer active." };

  const now = Date.now();
  if (code.starts_at && new Date(code.starts_at).getTime() > now) {
    return { ok: false, error: "That code is not live yet." };
  }
  if (code.expires_at && new Date(code.expires_at).getTime() < now) {
    return { ok: false, error: "That code has expired." };
  }
  if (!code.scopes.includes(args.scope)) {
    return { ok: false, error: "That code cannot be used on this purchase." };
  }
  if (code.max_uses != null && code.used_count >= code.max_uses) {
    return { ok: false, error: "That code has been fully claimed." };
  }
  if (args.subtotalPaise < code.min_spend_paise) {
    return {
      ok: false,
      error: `Spend at least ₹${Math.round(code.min_spend_paise / 100).toLocaleString("en-IN")} to use this code.`,
    };
  }

  if (code.per_user_limit != null) {
    if (!args.userId) return { ok: false, error: "Sign in to use this code." };
    const [mine] = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM discount_redemptions WHERE code_id = $1 AND user_id = $2`,
      [code.id, args.userId],
    ).catch(() => [{ n: 0 }]);
    if ((mine?.n ?? 0) >= code.per_user_limit) {
      return { ok: false, error: "You have already used that code." };
    }
  }

  const discountPaise = valueOf(code, args.subtotalPaise);
  if (discountPaise <= 0) return { ok: false, error: "That code takes nothing off this basket." };

  return {
    ok: true,
    code,
    discountPaise,
    netPaise: args.subtotalPaise - discountPaise,
    label: describe(code),
  };
}

/**
 * Consume one use. Returns null if the code ran out between quoting and here —
 * the caller must treat that as "charge full price", never as "give it anyway".
 *
 * The cap is enforced inside the UPDATE. Reading the count and then writing it
 * back would let two simultaneous redemptions both see 49 of 50 and both pass.
 */
export async function redeem(args: {
  codeId: string;
  userId?: string | null;
  scope: DiscountScope;
  reference: string;
  discountPaise: number;
}): Promise<boolean> {
  const claimed = await query<{ id: string }>(
    `UPDATE discount_codes
     SET used_count = used_count + 1, updated_at = now()
     WHERE id = $1
       AND active
       AND (max_uses IS NULL OR used_count < max_uses)
       AND (starts_at IS NULL OR starts_at <= now())
       AND (expires_at IS NULL OR expires_at >= now())
     RETURNING id`,
    [args.codeId],
  ).catch(() => []);

  if (claimed.length === 0) return false;

  await query(
    `INSERT INTO discount_redemptions (code_id, user_id, scope, reference, discount_paise)
     VALUES ($1,$2,$3,$4,$5)`,
    [args.codeId, args.userId ?? null, args.scope, args.reference, args.discountPaise],
  ).catch((err) => {
    // The claim is what matters for the cap; losing the journal row would
    // understate reporting but must not hand out a second discount.
    console.error("[discounts] redemption journal failed:", err);
  });

  return true;
}

/** Give a use back when the purchase it was claimed for did not complete. */
export async function releaseRedemption(codeId: string, reference: string): Promise<void> {
  await query(
    `UPDATE discount_codes SET used_count = GREATEST(0, used_count - 1), updated_at = now() WHERE id = $1`,
    [codeId],
  ).catch(() => {});
  await query(`DELETE FROM discount_redemptions WHERE code_id = $1 AND reference = $2`, [codeId, reference]).catch(
    () => {},
  );
}
