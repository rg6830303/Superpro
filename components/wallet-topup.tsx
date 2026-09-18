"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { openRazorpay, useRazorpayPreload } from "@/components/razorpay-client";
import { Alert, Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";

const PRESETS = [500, 1000, 2500, 5000];

/**
 * Player-initiated wallet top-up.
 *
 * The wallet is credited server-side after signature verification, never here —
 * this component only opens the gateway and then refreshes to show the new
 * balance. When Razorpay is not configured it says so plainly rather than
 * offering a button that cannot work.
 */
export function WalletTopUp({
  razorpayEnabled,
  razorpayKeyId,
  name,
  email,
  phone,
}: {
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  name: string;
  email: string;
  phone?: string | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(1000);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Fetch the payment script while the form is being filled in, so pressing
  // Pay opens the window straight away instead of waiting on a download.
  useRazorpayPreload(razorpayEnabled);

  /**
   * The escape hatch for a payment that went through while the callback did
   * not. Asks the server to re-check this player's unconfirmed top-ups against
   * Razorpay directly, which is the only authoritative answer.
   */
  async function recheck() {
    setChecking(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/wallet/reconcile", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not check those payments.");
      if (data.credited > 0) {
        setDone(`Found ${data.credited} payment${data.credited === 1 ? "" : "s"} — ${formatPaise(data.creditedPaise)} added.`);
        router.refresh();
      } else {
        setDone("No unconfirmed payments found. If money left your account, message a rep with the reference.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check those payments.");
    } finally {
      setChecking(false);
    }
  }

  const value = custom.trim() !== "" ? Number(custom) : amount;
  const valid = Number.isFinite(value) && value >= 100 && value <= 50000;

  async function topUp() {
    if (!valid) {
      setError("Enter an amount between ₹100 and ₹50,000.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_rupees: Math.round(value) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the top-up.");

      const opened = await openRazorpay({
        keyId: razorpayKeyId,
        orderId: data.razorpay_order_id,
        amountPaise: data.amount_paise,
        name: "SuperPro Wallet",
        description: `Top up ${formatPaise(data.amount_paise)}`,
        prefill: { name, email, contact: phone ?? "" },
        notes: { reference: data.reference },
        onSuccess: async (payload) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "wallet_topup", reference: data.reference, ...payload }),
          });
          if (verify.ok) {
            const body = await verify.json();
            setDone(
              body.balance_paise != null
                ? `Added. Your balance is now ${formatPaise(body.balance_paise)}.`
                : "Top-up received.",
            );
            router.refresh();
          } else {
            // The money is taken and the ledger row is still pending; the
            // reconciler will find it. Try immediately rather than making the
            // player wait and worry.
            setBusy(false);
            await recheck();
          }
          setBusy(false);
        },
        onDismiss: () => setBusy(false),
      });

      if (!opened) {
        setError("The payment window could not open. A rep can load your wallet at the venue instead.");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the top-up.");
      setBusy(false);
    }
  }

  if (!razorpayEnabled) {
    return (
      <div className="rounded-xl border border-line bg-mist p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Wallet size={15} className="text-volt-deep" /> Top up at the venue
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink/60">
          Online top-ups switch on once card payments are connected. Until then any SuperPro rep can load your
          wallet on court and it appears here straight away.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Plus size={15} className="text-volt-deep" /> Add money
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setAmount(p);
              setCustom("");
            }}
            className={`rounded-pill border px-4 py-2 text-sm font-semibold tabular-nums transition-colors ${
              custom.trim() === "" && amount === p
                ? "border-ink bg-volt-soft text-ink"
                : "border-line text-ink/65 hover:border-ink/40"
            }`}
          >
            ₹{p.toLocaleString("en-IN")}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <label className="label" htmlFor="topup-custom">
          Or another amount (₹)
        </label>
        <input
          id="topup-custom"
          className="field"
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      </div>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {done && (
        <div className="mt-3">
          <Alert tone="ok">{done}</Alert>
        </div>
      )}

      <button type="button" onClick={topUp} disabled={busy || !valid} className="btn-volt mt-4 w-full">
        {busy ? <Spinner /> : null}
        {busy ? "Opening payment…" : `Add ${valid ? `₹${Math.round(value).toLocaleString("en-IN")}` : "money"}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-ink/45">
        Wallet credit can be spent on court slots and gear at checkout.
      </p>

      <button
        type="button"
        onClick={recheck}
        disabled={checking || busy}
        className="mt-3 w-full text-center text-[11px] text-ink/45 underline transition-colors hover:text-ink"
      >
        {checking ? "Checking…" : "Paid but not showing? Check again"}
      </button>
    </div>
  );
}
