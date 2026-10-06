"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Spinner } from "@/components/ui";
import { useRazorpayPreload } from "@/components/razorpay-client";
import { payForRegistration } from "@/components/coaching-pay";
import { VENUES, feeFor, formatRupees } from "@/lib/coaching-program";

/** "Pay now" on a registration's status page, with a choice of the player's venues. */
export function CoachingPayButton({
  reference,
  venues,
  payVenue,
  age,
}: {
  reference: string;
  venues: string[];
  payVenue: string;
  age: number;
}) {
  const router = useRouter();
  useRazorpayPreload(true);
  const [venue, setVenue] = useState(payVenue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fee = feeFor(venue, age);

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/coaching/register/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference, venue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start the payment.");
      const outcome = await payForRegistration(data);
      if (outcome === "paid") router.replace(`/coaching/registration/${reference}?paid=1`);
      else if (outcome === "failed") setError("The payment didn't go through. You haven't been charged twice — try again or call us.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {venues.length > 1 && (
        <div>
          <label className="label" htmlFor="pay-venue">Venue to pay for</label>
          <select id="pay-venue" className="field" value={venue} onChange={(e) => setVenue(e.target.value)}>
            {venues.map((id) => {
              const v = VENUES.find((x) => x.id === id);
              const f = feeFor(id, age);
              return (
                <option key={id} value={id} disabled={f == null}>
                  {v?.name ?? id} — {f == null ? "adults only" : formatRupees(f)}
                </option>
              );
            })}
          </select>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      <button type="button" onClick={pay} disabled={busy || fee == null} className="btn-volt w-full">
        {busy ? <Spinner /> : null} {busy ? "Opening payment…" : `Pay ${fee != null ? formatRupees(fee) : ""} & confirm my slot`}
      </button>
    </div>
  );
}
