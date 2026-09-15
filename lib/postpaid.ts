/**
 * Postpaid rules, kept free of server-only imports.
 *
 * The wallet module reaches Postgres and Razorpay, which drags `node:crypto`
 * into anything that imports it. These three facts are needed by client
 * components too — the dashboard, the games checkout — so they live here and
 * `lib/wallet` re-exports them for server callers.
 */

/**
 * How far a wallet may go into the red.
 *
 * Players keep playing for a while after the credit runs out; the club would
 * rather someone finished their week than was turned away over a few hundred
 * rupees. Past this floor the account is settled before a new daily-games slot
 * can be booked.
 */
export const WALLET_FLOOR_PAISE = -100000; // -Rs 1,000

/** True when the account is at or past the floor and has to be cleared. */
export function isBlocked(balancePaise: number): boolean {
  return balancePaise <= WALLET_FLOOR_PAISE;
}

/** What must be paid to bring an account back above zero. */
export function duesPaise(balancePaise: number): number {
  return balancePaise < 0 ? Math.abs(balancePaise) : 0;
}

/** Whether a purchase of this size still leaves the account above the floor. */
export function canSpend(balancePaise: number, amountPaise: number): boolean {
  return balancePaise - amountPaise >= WALLET_FLOOR_PAISE;
}
