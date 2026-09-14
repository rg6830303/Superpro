import crypto from "node:crypto";

/**
 * Razorpay is optional. Without keys the app still takes bookings and orders —
 * checkout simply falls back to "pay at the venue / cash on delivery", which is
 * how the club already operates. `isRazorpayEnabled` drives that fallback.
 */
/**
 * Either spelling of the key id works. The id is only ever read on the server
 * and handed to the browser as a prop, so it does not need the NEXT_PUBLIC_
 * prefix — but that is the name most people reach for, and a payment system
 * that silently stays off because of a variable name is a bad trade.
 */
const KEY_ID = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
const KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY || "").trim();

export const isRazorpayEnabled = Boolean(KEY_ID && KEY_SECRET);
export const razorpayKeyId = KEY_ID;

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt?: string };

export async function createRazorpayOrder(args: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!isRazorpayEnabled) throw new Error("Razorpay is not configured");
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: args.amountPaise,
      currency: "INR",
      receipt: args.receipt,
      notes: args.notes ?? {},
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay order failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify the checkout callback signature. NEVER mark a payment paid without
 * this — the client-side handler is trivially forgeable.
 */
export function verifyRazorpaySignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${args.orderId}|${args.paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(args.signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Basic auth header for the REST API. Server-only: the secret never ships. */
function authHeader(): string {
  return `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`;
}

export type RazorpayPayment = {
  id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  order_id: string;
};

/**
 * Ask Razorpay what actually happened to an order.
 *
 * The browser callback is not a reliable delivery mechanism — a player can pay
 * and then close the tab, lose signal, or have the verify request fail, and the
 * money is taken while the wallet is never credited. This is the authoritative
 * answer, and it needs nothing but the key id and secret.
 */
export async function fetchOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  if (!isRazorpayEnabled) return [];
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: { authorization: authHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Razorpay lookup failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const body = (await res.json()) as { items?: RazorpayPayment[] };
  return body.items ?? [];
}

/** A payment counts as money received only once it is captured. */
export function capturedPayment(payments: RazorpayPayment[]): RazorpayPayment | null {
  return payments.find((p) => p.status === "captured") ?? null;
}
