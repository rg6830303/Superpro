"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Spinner } from "@/components/ui";
import { useRazorpayPreload } from "@/components/razorpay-client";
import { payForRegistration } from "@/components/coaching-pay";

/** "Pay now" on an appointment's status page. */
export function DoctorPayButton({ reference, fee, doctorHandle }: { reference: string; fee: number; doctorHandle: string }) {
  const router = useRouter();
  useRazorpayPreload(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/medical/book/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start the payment.");
      const outcome = await payForRegistration(data, { kind: "doctor_appointment", name: `${doctorHandle} · Clinic visit`, description: `Consultation · ${reference}` });
      if (outcome === "paid") router.replace(`/medical/appointment/${reference}?paid=1`);
      else if (outcome === "failed") setError("The payment didn't go through. Try again or call us.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <button type="button" onClick={pay} disabled={busy} className="btn-volt w-full">
        {busy ? <Spinner /> : null} {busy ? "Opening payment…" : `Pay ₹${fee} & confirm`}
      </button>
    </div>
  );
}
