import crypto from "node:crypto";

/**
 * Razorpay is optional. Without keys the app still takes bookings and orders —
 * checkout simply falls back to "pay at the venue / cash on delivery", which is
 * how the club already operates. `isRazorpayEnabled` drives that fallback.
 */
const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

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
