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
