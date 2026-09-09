"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { EmptyState } from "@/components/ui";
import { formatPaise, FREE_SHIPPING_THRESHOLD_PAISE } from "@/lib/money";

export default function CartPage() {
  const { lines, setQty, remove, subtotalPaise, count, ready } = useCart();

  if (!ready) {
    return <div className="wrap section text-sm text-ink/55">Loading your cart…</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="wrap section">
        <h1 className="mb-8 text-5xl">Cart</h1>
        <EmptyState
          title="Nothing in the cart yet"
          sub="Paddles, balls and grips from the Champion Series are a click away."
          action={
            <Link href="/products" className="btn-volt btn-sm mt-2">
              <ShoppingBag size={14} /> Browse the shop
            </Link>
          }
        />
      </div>
    );
  }

  const remaining = FREE_SHIPPING_THRESHOLD_PAISE - subtotalPaise;

  return (
    <div className="wrap section">
      <h1 className="headline-page">Cart</h1>
      <p className="mt-2 text-sm text-ink/65">
        {count} item{count === 1 ? "" : "s"}
      </p>

      <div className="mt-9 grid min-w-0 gap-8 lg:grid-cols-[1.5fr_1fr]">
        <ul className="space-y-3">
          {lines.map((l) => (
            <li key={l.product_id} className="card flex gap-4 p-4">
              <Link href={`/products/${l.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-mist">
                {l.image_url ? (
                  <Image src={l.image_url} alt={l.name} fill sizes="96px" className="object-contain p-2" />
                ) : null}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/products/${l.slug}`} className="font-display text-xl uppercase text-ink hover:text-volt-deep">
                  {l.name}
                </Link>
                <p className="mt-0.5 text-sm text-ink/65">{formatPaise(l.price_paise)} each</p>

                <div className="mt-auto flex items-center gap-3 pt-3">
                  <div className="flex items-center rounded-full border border-line">
                    <button
                      type="button"
                      onClick={() => setQty(l.product_id, l.qty - 1)}
                      className="p-2 text-ink/75 hover:text-ink"
                      aria-label={`Decrease quantity of ${l.name}`}
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-ink">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(l.product_id, l.qty + 1)}
                      className="p-2 text-ink/75 hover:text-ink"
                      aria-label={`Increase quantity of ${l.name}`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(l.product_id)}
                    className="rounded-lg p-2 text-ink/45 transition-colors hover:bg-signal/10 hover:text-signal"
                    aria-label={`Remove ${l.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <p className="font-display text-2xl text-ink">{formatPaise(l.price_paise * l.qty)}</p>
            </li>
          ))}
        </ul>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="text-2xl">Summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/70">Subtotal</dt>
                <dd className="text-ink">{formatPaise(subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/70">Delivery</dt>
                <dd className="text-ink/75">Calculated at checkout</dd>
              </div>
            </dl>

            {remaining > 0 && (
              <p className="mt-4 rounded-xl bg-volt-soft px-4 py-3 text-xs text-volt-deep">
                Add {formatPaise(remaining)} more for free delivery in Kolkata.
              </p>
            )}

            <Link href="/checkout" className="btn-volt mt-6 w-full">
              Checkout
            </Link>
            <Link href="/products" className="btn-ghost mt-2 w-full">
              Keep shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
