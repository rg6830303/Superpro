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
  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, code, description, kind, percent_off, amount_off_paise, max_discount_paise,
            min_spend_paise, max_uses, used_count, per_user_limit, scopes,
            starts_at::text AS starts_at, expires_at::text AS expires_at, active
     FROM discount_codes WHERE upper(code) = $1 LIMIT 1`,
    [normaliseCode(code)],
  ).catch(() => null);

  if (!row) return null;

  let scopes: DiscountScope[] = [];
  if (Array.isArray(row.scopes)) {
    scopes = row.scopes as DiscountScope[];
  } else if (typeof row.scopes === "string") {
    scopes = (row.scopes as string)
      .replace(/[{}"']/g, "")
      .split(",")
      .map((s) => s.trim() as DiscountScope)
      .filter(Boolean);
  } else {
    scopes = ["shop", "games", "coaching", "tournaments"];
  }

  return {
    id: String(row.id),
    code: String(row.code),
    description: row.description ? String(row.description) : null,
    kind: row.kind === "amount" ? "amount" : "percent",
    percent_off: row.percent_off != null ? Number(row.percent_off) : null,
    amount_off_paise: row.amount_off_paise != null ? Math.round(Number(row.amount_off_paise)) : null,
    max_discount_paise: row.max_discount_paise != null ? Math.round(Number(row.max_discount_paise)) : null,
    min_spend_paise: Math.round(Number(row.min_spend_paise ?? 0)),
    max_uses: row.max_uses != null ? Math.round(Number(row.max_uses)) : null,
    used_count: Math.round(Number(row.used_count ?? 0)),
    per_user_limit: row.per_user_limit != null ? Math.round(Number(row.per_user_limit)) : null,
    scopes,
    starts_at: row.starts_at ? String(row.starts_at) : null,
    expires_at: row.expires_at ? String(row.expires_at) : null,
    active: Boolean(row.active),
  };
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
    : `₹${Math.round(Number(code.amount_off_paise ?? 0) / 100).toLocaleString("en-IN")} off`;
}

/**
 * Check a code without consuming it — what the checkout calls as the customer
 * types. Every reason for refusal is spelled out, because "invalid code" when
 * the real problem is a minimum spend is a support ticket.
 */
export async function quote(args: {
  code: string;
  scope?: DiscountScope | DiscountScope[];
  subtotalPaise: number;
  productSubtotalPaise?: number;
  slotSubtotalPaise?: number;
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

  const codeScopes = code.scopes && code.scopes.length > 0 ? code.scopes : ["shop", "games", "coaching", "tournaments"];
  const isAll = (codeScopes as string[]).includes("all") || codeScopes.length >= 4;

  const requestedScopes: DiscountScope[] = Array.isArray(args.scope)
    ? args.scope
    : args.scope
      ? [args.scope]
      : ["shop", "games", "coaching", "tournaments"];

  const matchesScope = isAll || requestedScopes.some((s) => codeScopes.includes(s));
  if (!matchesScope) {
    return { ok: false, error: "That code cannot be used on this purchase." };
  }

  if (code.max_uses != null && code.used_count >= code.max_uses) {
    return { ok: false, error: "That code has been fully claimed." };
  }

  // Determine eligible amount for applying the discount:
  // If code is specifically for shop, only goods qualify.
  // If code is specifically for daily games, only court slots qualify.
  let eligiblePaise = args.subtotalPaise;
  if (!isAll) {
    const isShopOnly = codeScopes.includes("shop") && !codeScopes.includes("games");
    const isGamesOnly = codeScopes.includes("games") && !codeScopes.includes("shop");
    if (isShopOnly && args.productSubtotalPaise != null && args.productSubtotalPaise > 0) {
      eligiblePaise = args.productSubtotalPaise;
    } else if (isGamesOnly && args.slotSubtotalPaise != null && args.slotSubtotalPaise > 0) {
      eligiblePaise = args.slotSubtotalPaise;
    }
  }

  if (eligiblePaise < code.min_spend_paise) {
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

  const discountPaise = valueOf(code, eligiblePaise);
  if (discountPaise <= 0) return { ok: false, error: "That code takes nothing off this basket." };

  return {
    ok: true,
    code,
    discountPaise,
    netPaise: Math.max(0, args.subtotalPaise - discountPaise),
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
