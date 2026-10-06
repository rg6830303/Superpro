"use client";

import { openRazorpay } from "@/components/razorpay-client";
import { PROGRAM } from "@/lib/coaching-program";

export type PayStart = {
  reference: string;
  order: { id: string; amount: number } | null;
  key_id: string | null;
  prefill?: { name?: string; contact?: string; email?: string };
};

/**
 * Open Razorpay for a registration and confirm it server-side. Resolves to
 * "paid", "dismissed" or "failed" — the registration exists either way.
 */
export function payForRegistration(start: PayStart): Promise<"paid" | "dismissed" | "failed"> {
  return new Promise((resolve) => {
    if (!start.order || !start.key_id) return resolve("failed");
    void openRazorpay({
      keyId: start.key_id,
      orderId: start.order.id,
      amountPaise: start.order.amount,
      name: PROGRAM.name,
      description: `Group coaching · ${start.reference}`,
      prefill: start.prefill,
      notes: { reference: start.reference },
      onDismiss: () => resolve("dismissed"),
      onSuccess: async (res) => {
        try {
          const r = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "coaching_registration", reference: start.reference, ...res }),
          });
          resolve(r.ok ? "paid" : "failed");
        } catch {
          resolve("failed");
        }
      },
    }).then((opened) => {
      if (!opened) resolve("failed");
    });
  });
}
