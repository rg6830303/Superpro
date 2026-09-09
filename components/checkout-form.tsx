"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banknote, CreditCard, ShoppingBag, Store, Truck, Wallet } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { openRazorpay } from "@/components/razorpay-client";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { formatPaise, shippingFor } from "@/lib/money";

type Props = {
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  /** Signed-in customer's wallet balance; 0 (or signed out) hides the option. */
  walletPaise?: number;
  defaults?: { name?: string; phone?: string; email?: string };
};

type DeliveryMode = "pickup" | "delivery";
type PayMethod = "razorpay" | "cod" | "wallet";

export function CheckoutForm({ razorpayEnabled, razorpayKeyId, walletPaise = 0, defaults }: Props) {
  const { lines, subtotalPaise, clear, ready } = useCart();
  const router = useRouter();

  const [name, setName] = useState(defaults?.name ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [mode, setMode] = useState<DeliveryMode>("pickup");
  const [address, setAddress] = useState({ line1: "", line2: "", city: "Kolkata", pincode: "" });
  const [pay, setPay] = useState<PayMethod>(razorpayEnabled ? "razorpay" : "cod");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <p className="py-16 text-sm text-ink/55">Loading…</p>;

  if (lines.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        sub="Add a paddle, ball or grip and come back here to check out."
        action={
          <Link href="/products" className="btn-volt btn-sm mt-2">
            <ShoppingBag size={14} /> Browse the shop
          </Link>
        }
      />
    );
  }

  const shipping = shippingFor(subtotalPaise, mode);
  const total = subtotalPaise + shipping;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
          delivery_mode: mode,
          address: mode === "delivery" ? address : undefined,
          payment_method: pay,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not place the order.");

      // Cash / pickup — order is already recorded, go straight to confirmation.
      if (!data.razorpay_order_id) {
        clear();
        router.push(`/order/${data.order_no}`);
        return;
      }

      const opened = await openRazorpay({
        keyId: razorpayKeyId,
        orderId: data.razorpay_order_id,
        amountPaise: data.total_paise,
        name: "SuperPro",
        description: `Order ${data.order_no}`,
        prefill: { name, email, contact: phone },
        notes: { order_no: data.order_no },
        onSuccess: async (payload) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "order", id: data.order_id, ...payload }),
          });
          if (verify.ok) {
            clear();
            router.push(`/order/${data.order_no}`);
          } else {
            setError("Payment could not be verified. Nothing was charged twice — message a rep with your order number.");
            setBusy(false);
          }
        },
        onDismiss: () => setBusy(false),
      });

      if (!opened) {
        setError("Payment window could not open. Choose cash on delivery, or message a rep.");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-8">
        <section className="card p-6">
          <h2 className="text-2xl">Your details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="co-name">Full name</label>
              <input id="co-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Ishaan Sanghvi" />
            </div>
            <div>
              <label className="label" htmlFor="co-phone">WhatsApp number</label>
              <input id="co-phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="numeric" placeholder="98xxxxxxxx" />
            </div>
            <div>
              <label className="label" htmlFor="co-email">Email (optional)</label>
              <input id="co-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-2xl">How do you want it?</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setMode("pickup")} className={`tile ${mode === "pickup" ? "tile-selected" : ""}`}>
              <Store size={18} className="text-volt-deep" />
              <p className="mt-2 font-display text-lg uppercase text-ink">Pickup — free</p>
              <p className="mt-1 text-xs text-ink/65">Collect at TurfXL, New Alipore. Ready in 24 hours.</p>
            </button>
            <button type="button" onClick={() => setMode("delivery")} className={`tile ${mode === "delivery" ? "tile-selected" : ""}`}>
              <Truck size={18} className="text-volt-deep" />
              <p className="mt-2 font-display text-lg uppercase text-ink">Delivery</p>
              <p className="mt-1 text-xs text-ink/65">Anywhere in Kolkata. ₹99, free over ₹5,000.</p>
            </button>
          </div>

          {mode === "delivery" && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ad1">Address line 1</label>
                <input id="ad1" className="field" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} required placeholder="Flat / house, street" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ad2">Landmark (optional)</label>
                <input id="ad2" className="field" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="adcity">City</label>
                <input id="adcity" className="field" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="adpin">PIN code</label>
                <input id="adpin" className="field" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} required inputMode="numeric" placeholder="700053" />
              </div>
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="text-2xl">Payment</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => razorpayEnabled && setPay("razorpay")}
              disabled={!razorpayEnabled}
              className={`tile ${pay === "razorpay" ? "tile-selected" : ""} ${!razorpayEnabled ? "opacity-40" : ""}`}
            >
              <CreditCard size={18} className="text-volt-deep" />
              <p className="mt-2 font-display text-lg uppercase text-ink">Pay online</p>
              <p className="mt-1 text-xs text-ink/65">
                {razorpayEnabled ? "UPI, card or netbanking. Confirms instantly." : "Temporarily unavailable."}
              </p>
            </button>
            <button type="button" onClick={() => setPay("cod")} className={`tile ${pay === "cod" ? "tile-selected" : ""}`}>
              <Banknote size={18} className="text-volt-deep" />
              <p className="mt-2 font-display text-lg uppercase text-ink">
                {mode === "pickup" ? "Pay on pickup" : "Cash on delivery"}
              </p>
              <p className="mt-1 text-xs text-ink/65">Cash or UPI when you collect it.</p>
            </button>
            {walletPaise > 0 && (
              <button
                type="button"
                onClick={() => setPay("wallet")}
                disabled={walletPaise < total}
                className={`tile sm:col-span-2 ${pay === "wallet" ? "tile-selected" : ""} ${walletPaise < total ? "opacity-40" : ""}`}
              >
                <Wallet size={18} className="text-volt-deep" />
                <p className="mt-2 font-display text-lg uppercase text-ink">SuperPro wallet</p>
                <p className="mt-1 text-xs text-ink/65">
                  {walletPaise < total
                    ? `Only ${formatPaise(walletPaise)} left — not enough for this order.`
                    : `${formatPaise(walletPaise)} available. Paid instantly, nothing else to do.`}
                </p>
              </button>
            )}
          </div>

          <div className="mt-5">
            <label className="label" htmlFor="co-notes">Anything we should know? (optional)</label>
            <textarea id="co-notes" rows={2} className="field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Grip size, delivery timing…" />
          </div>
        </section>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6">
          <h2 className="text-2xl">Order summary</h2>
          <ul className="mt-5 space-y-3">
            {lines.map((l) => (
              <li key={l.product_id} className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-mist">
                  {l.image_url && <Image src={l.image_url} alt="" fill sizes="48px" className="object-contain p-1" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{l.name}</p>
                  <p className="text-xs text-ink/55">Qty {l.qty}</p>
                </div>
                <p className="text-sm text-ink/80">{formatPaise(l.price_paise * l.qty)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/70">Subtotal</dt>
              <dd className="text-ink">{formatPaise(subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/70">{mode === "pickup" ? "Pickup" : "Delivery"}</dt>
              <dd className={shipping === 0 ? "text-volt-deep" : "text-ink"}>{shipping === 0 ? "Free" : formatPaise(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3">
              <dt className="font-display text-xl uppercase text-ink">Total</dt>
              <dd className="font-display text-xl text-volt-deep">{formatPaise(total)}</dd>
            </div>
          </dl>

          {error && (
            <div className="mt-5">
              <Alert>{error}</Alert>
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-volt mt-6 w-full">
            {busy ? <Spinner /> : null}
            {busy
              ? "Placing order…"
              : pay === "razorpay"
                ? `Pay ${formatPaise(total)}`
                : pay === "wallet"
                  ? `Pay ${formatPaise(total)} from wallet`
                  : "Place order"}
          </button>
          <p className="mt-3 text-center text-[11px] text-ink/45">
            You&apos;ll get a WhatsApp confirmation with your order number.
          </p>
        </div>
      </aside>
    </form>
  );
}
