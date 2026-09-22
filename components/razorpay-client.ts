"use client";

import { useEffect } from "react";

/**
 * Thin wrapper around Razorpay's checkout widget.
 *
 * The script is not shipped on every page — it is fetched the first time a page
 * that can actually take money is rendered (see `useRazorpayPreload`), so the
 * widget is already parsed and warm by the time someone presses Pay. Loading it
 * lazily *at the moment of payment* is what makes checkout feel slow: the order
 * round-trip and a ~100KB third-party script end up in series.
 *
 * Every payment is still verified server-side afterwards — the `handler`
 * callback alone proves nothing.
 */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Long enough for a bad mobile connection, short enough to fall back on. */
const LOAD_TIMEOUT_MS = 15_000;

let loader: Promise<boolean> | null = null;

/**
 * Fetch the checkout script, once per page.
 *
 * A failure is deliberately NOT cached: a single flaky request on a train
 * should not disable online payment for the rest of the session, so the next
 * caller gets a fresh attempt.
 */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loader) return loader;

  const attempt = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      resolve(ok || Boolean(window.Razorpay));
    };

    // The script may already be in the document from an earlier attempt whose
    // load event has long since fired; polling for the global covers that as
    // well as a browser that swallows the event.
    const poll = setInterval(() => {
      if (window.Razorpay) finish(true);
    }, 250);
    const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => finish(true));
    script.addEventListener("error", () => finish(false));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  loader = attempt.then((ok) => {
    if (!ok) loader = null; // let the next caller try again
    return ok;
  });

  return loader;
}

/**
 * Warm the checkout script while the customer is still filling the form.
 *
 * Call it from any page that can start a payment. It is a no-op when online
 * payment is switched off, and repeated calls share the single in-flight load.
 */
export function useRazorpayPreload(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;

    // Never block first paint or compete with the page's own resources — the
    // fetch is worth starting early, not urgently.
    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      const handle = idle.call(window, () => void loadRazorpay(), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => void loadRazorpay(), 300);
    return () => window.clearTimeout(handle);
  }, [enabled]);
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

/** Drop blank fields — Razorpay treats an empty string as a supplied value and
 *  shows a validation error on a field the customer never filled in. */
function cleanPrefill(prefill: RazorpayCheckoutArgs["prefill"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(prefill ?? {})) {
    const value = typeof v === "string" ? v.trim() : "";
    if (value) out[k] = value;
  }
  return out;
}

export async function openRazorpay(args: RazorpayCheckoutArgs): Promise<boolean> {
  const ok = await loadRazorpay();
  if (!ok || !window.Razorpay) return false;

  const rzp = new window.Razorpay({
    key: args.keyId,
    // `order_id` carries the amount Razorpay will actually charge — it is the
    // server-side order, so whatever the browser thinks the basket costs (with
    // or without a discount) cannot change the amount taken.
    order_id: args.orderId,
    amount: args.amountPaise,
    currency: "INR",
    name: args.name,
    description: args.description,
    image: "/icons/icon-192.png",
    prefill: cleanPrefill(args.prefill),
    notes: args.notes ?? {},
    theme: { color: "#C79620", backdrop_color: "#0A0A0B" },
    handler: args.onSuccess,
    modal: { ondismiss: args.onDismiss },
  });
  rzp.open();
  return true;
}
