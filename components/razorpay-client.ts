"use client";

/**
 * Thin wrapper around Razorpay's checkout widget. The script is injected on
 * first use rather than shipped on every page, and every payment is verified
 * server-side afterwards — the `handler` callback alone proves nothing.
 */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loader: Promise<boolean> | null = null;

export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loader) return loader;

  loader = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return loader;
}

export type RazorpayCheckoutArgs = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  onSuccess: (res: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onDismiss?: () => void;
};

export async function openRazorpay(args: RazorpayCheckoutArgs): Promise<boolean> {
  const ok = await loadRazorpay();
  if (!ok || !window.Razorpay) return false;

  const rzp = new window.Razorpay({
    key: args.keyId,
    order_id: args.orderId,
    amount: args.amountPaise,
    currency: "INR",
    name: args.name,
    description: args.description,
    image: "/icons/icon-192.png",
    prefill: args.prefill ?? {},
    notes: args.notes ?? {},
    theme: { color: "#C79620", backdrop_color: "#0A0A0B" },
    handler: args.onSuccess,
    modal: { ondismiss: args.onDismiss },
  });
  rzp.open();
  return true;
}
