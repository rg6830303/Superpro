/**
 * All money is stored and moved as integer PAISE. Rupee floats are only ever
 * produced at the last moment, for display.
 */
export function paise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function rupees(p: number): number {
  return p / 100;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹9,000 — drops paise when the amount is whole rupees. */
export function formatPaise(p: number | null | undefined): string {
  const value = Number(p ?? 0) / 100;
  return Number.isInteger(value) ? inr.format(value) : inrPrecise.format(value);
}

export function formatRupees(r: number): string {
  return Number.isInteger(r) ? inr.format(r) : inrPrecise.format(r);
}

/** Free delivery above this cart value; below it, flat shipping applies. */
export const FREE_SHIPPING_THRESHOLD_PAISE = 500000; // ₹5,000
export const FLAT_SHIPPING_PAISE = 9900; // ₹99

export function shippingFor(subtotalPaise: number, mode: "pickup" | "delivery"): number {
  if (mode === "pickup") return 0;
  if (subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE) return 0;
  return FLAT_SHIPPING_PAISE;
}

/** Short human reference, e.g. SP-7F3K2A. Unique enough for a customer to quote. */
export function newRef(prefix: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${out}`;
}

/**
 * What one player pays for a game slot.
 *
 * `fixed`  — a flat per-player price the admin sets directly.
 * `split`  — the court's hourly fee divided evenly across the slot's capacity.
 *            Dividing by capacity rather than by current bookings keeps the
 *            price deterministic: a player sees the same figure whether they
 *            book first or last, and nobody has to be refunded when the court
 *            fills up behind them.
 */
export type SlotPricing = {
  pricing_mode?: string | null;
  price_paise: number;
  court_fee_paise?: number | null;
  capacity: number;
};

export function perPlayerPaise(slot: SlotPricing): number {
  if (slot.pricing_mode !== "split") return slot.price_paise;
  const capacity = Math.max(1, slot.capacity);
  return Math.ceil(Number(slot.court_fee_paise ?? 0) / capacity);
}

/** "₹1,400 court ÷ 8 players" — shown next to a split price so the maths is visible. */
export function splitCaption(slot: SlotPricing): string | null {
  if (slot.pricing_mode !== "split") return null;
  return `${formatPaise(Number(slot.court_fee_paise ?? 0))} court ÷ ${Math.max(1, slot.capacity)} players`;
}
