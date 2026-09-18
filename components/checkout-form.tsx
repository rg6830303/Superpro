"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Banknote, CreditCard, ShoppingBag, Store, Truck, Wallet } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { openRazorpay, useRazorpayPreload } from "@/components/razorpay-client";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { formatPaise, shippingFor } from "@/lib/money";
import { priceBasket } from "@/lib/fees";

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
  const { lines, subtotalPaise, productSubtotalPaise, slotSubtotalPaise, hasProducts, hasSlots, clear, ready } = useCart();
  const [codeInput, setCodeInput] = useState("");
  const [discount, setDiscount] = useState<{ code: string; label: string; discount_paise: number } | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  /**
   * Quote a code against the basket as it stands. The server decides what the
   * code is worth — this only asks, and the same question is asked again when
   * the order is placed.
   */
  const quoteCode = useCallback(
    async (entered: string, opts: { silent?: boolean } = {}) => {
      const code = entered.trim();
      if (!code) return;
      if (!opts.silent) setCodeBusy(true);
      setCodeError(null);
      try {
        const res = await fetch("/api/discounts/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code, scope: hasProducts ? "shop" : "games", subtotal_paise: subtotalPaise }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not check that code.");
        if (!body.ok) {
          setDiscount(null);
          setCodeError(body.error);
          return;
        }
        setDiscount({ code: body.code, label: body.label, discount_paise: body.discount_paise });
      } catch (err) {
        setCodeError(err instanceof Error ? err.message : "Could not check that code.");
      } finally {
        if (!opts.silent) setCodeBusy(false);
      }
    },
    [hasProducts, subtotalPaise],
  );

  function applyCode() {
    return quoteCode(codeInput);
  }
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

  // A percentage code is worth a different amount once the basket changes, and
  // a minimum spend can stop being met. Re-quote rather than show a stale
  // figure that the server will not honour.
  const appliedCode = discount?.code ?? null;
  useEffect(() => {
    if (!appliedCode) return;
    void quoteCode(appliedCode, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCode, subtotalPaise, hasProducts]);

  // Warm the payment script while the form is being filled in, so pressing Pay
  // does not wait on a third-party download.
  useRazorpayPreload(razorpayEnabled);

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

  // Shipping only applies to goods, and only goods carry the convenience fee;
  // court time is a service the club already prices per head.
  const shipping = hasProducts ? shippingFor(productSubtotalPaise, mode) : 0;
  const totals = priceBasket({
    lines,
    shippingPaise: shipping,
    discountPaise: discount?.discount_paise ?? 0,
  });
  // The server re-prices everything at checkout; this is only what to show.
  const total = totals.totalPaise;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          lines: lines.map((l) => ({
            product_id: l.product_id,
            kind: l.kind ?? "product",
            qty: l.qty,
            session_id: l.session_id,
          })),
          delivery_mode: mode,
          address: mode === "delivery" ? address : undefined,
          payment_method: pay,
          // Without this the server prices the basket at full price and the
          // amount at the payment window does not match the summary above.
          discount_code: discount?.code,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // A code that ran out between quoting it and pressing Pay comes back
        // as a conflict. Drop it so the summary stops promising money off and
        // the order can be placed again at the price actually charged.
        if (res.status === 409 && discount) {
          setDiscount(null);
          setCodeError(data.error ?? "That code is no longer valid.");
        }
        throw new Error(data.error ?? "Could not place the order.");
      }

      // Cash / pickup — order is already recorded, go straight to confirmation.
      if (!data.razorpay_order_id) {
        clear();
        router.push(`/order/${data.reference}`);
        return;
      }

      const opened = await openRazorpay({
        keyId: razorpayKeyId,
        orderId: data.razorpay_order_id,
        amountPaise: data.total_paise,
        name: "SuperPro",
        description: `SuperPro ${data.reference}`,
        prefill: { name, email, contact: phone },
        notes: { reference: data.reference },
        onSuccess: async (payload) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "checkout", reference: data.reference, ...payload }),
          });
          if (verify.ok) {
            clear();
            router.push(`/order/${data.reference}`);
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
              <input id="co-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div>
              <label className="label" htmlFor="co-phone">WhatsApp number</label>
              <input id="co-phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="numeric" />
            </div>
            <div>
              <label className="label" htmlFor="co-email">Email (optional)</label>
              <input id="co-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                <input id="ad1" className="field" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} required />
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
                <input id="adpin" className="field" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} required inputMode="numeric" />
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
            <textarea id="co-notes" rows={2} className="field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)}  />
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

          <div className="mt-5 border-t border-line pt-5">
            <label className="label" htmlFor="promo">
              Discount code
            </label>
            <div className="flex gap-2">
              <input
                id="promo"
                className="field flex-1 uppercase"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  setCodeError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCode();
                  }
                }}
                autoCapitalize="characters"
                autoComplete="off"
              />
              {discount ? (
                <button
                  type="button"
                  className="btn-outline shrink-0"
                  onClick={() => {
                    setDiscount(null);
                    setCodeInput("");
                    setCodeError(null);
                  }}
                >
                  Remove
                </button>
              ) : (
                <button type="button" className="btn-outline shrink-0" disabled={codeBusy || !codeInput.trim()} onClick={applyCode}>
                  {codeBusy ? <Spinner /> : null} Apply
                </button>
              )}
            </div>
            {codeError && <p className="field-error">{codeError}</p>}
            {discount && (
              <p className="mt-1.5 text-[11px] text-volt-deep">
                {discount.label} applied. Checked again when you pay.
              </p>
            )}
          </div>

          <dl className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
            {hasProducts && (
              <div className="flex justify-between">
                <dt className="text-ink/70">Gear</dt>
                <dd className="text-ink">{formatPaise(productSubtotalPaise)}</dd>
              </div>
            )}
            {hasSlots && (
              <div className="flex justify-between">
                <dt className="text-ink/70">Court time</dt>
                <dd className="text-ink">{formatPaise(slotSubtotalPaise)}</dd>
              </div>
            )}
            {discount && (
              <div className="flex justify-between">
                <dt className="text-volt-deep">
                  {discount.code} · {discount.label}
                </dt>
                <dd className="text-volt-deep">-{formatPaise(discount.discount_paise)}</dd>
              </div>
            )}
            {totals.convenienceFeePaise > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink/70">Convenience fee</dt>
                <dd className="text-ink">{formatPaise(totals.convenienceFeePaise)}</dd>
              </div>
            )}
            {hasProducts && (
            <div className="flex justify-between">
              <dt className="text-ink/70">{mode === "pickup" ? "Pickup" : "Delivery"}</dt>
              <dd className={shipping === 0 ? "text-volt-deep" : "text-ink"}>{shipping === 0 ? "Free" : formatPaise(shipping)}</dd>
            </div>
            )}
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
