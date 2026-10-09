"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, MessageCircle, Play, Plus, ShoppingBag } from "lucide-react";
import { productMedia } from "@/lib/product-media";
import { useCart } from "@/components/cart-provider";
import { formatPaise } from "@/lib/money";
import { waLink } from "@/lib/site";
import type { Product } from "@/lib/types";

export function ProductGallery({ product }: { product: Product }) {
  const items = productMedia(product);
  const [active, setActive] = useState(0);
  const current = items[Math.min(active, items.length - 1)];

  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-mist font-display text-3xl uppercase text-ink/25">
        {product.name}
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-mist">
        {current.type === "video" ? (
          <video
            key={current.url}
            src={current.url}
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
            aria-label={`${product.name} video`}
          />
        ) : (
          <Image src={current.url} alt={current.alt || product.name} fill priority={active === 0} sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain p-6" />
        )}
        {items.length > 1 && (
          <>
            <button type="button" aria-label="Previous" onClick={() => setActive((i) => (i - 1 + items.length) % items.length)} className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-paper/85 text-ink shadow hover:bg-paper">
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="Next" onClick={() => setActive((i) => (i + 1) % items.length)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-paper/85 text-ink shadow hover:bg-paper">
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {items.map((m, i) => (
            <button
              key={m.url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View ${m.type === "video" ? "video" : "photo"} ${i + 1}`}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-mist transition-all ${i === active ? "ring-2 ring-ink" : "opacity-60 hover:opacity-100"}`}
            >
              {m.type === "video" ? (
                <>
                  <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-ink/25 text-paper"><Play size={18} fill="currentColor" /></span>
                </>
              ) : (
                <Image src={m.url} alt="" fill sizes="80px" className="object-contain p-1.5" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductBuyBox({ product }: { product: Product }) {
  const { add } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock <= 0;

  const line = {
    product_id: product.id,
    slug: product.slug,
    name: product.name,
    price_paise: product.price_paise,
    image_url: product.image_url,
  };

  const onAdd = () => {
    add(line, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const onBuyNow = () => {
    add(line, qty);
    router.push("/checkout");
  };

  return (
    <div className="mt-8">
      <div className="flex items-end gap-4">
        <p className="font-display text-5xl text-ink">{formatPaise(product.price_paise)}</p>
        {product.compare_at_paise && product.compare_at_paise > product.price_paise && (
          <p className="pb-2 text-base text-ink/45 line-through">{formatPaise(product.compare_at_paise)}</p>
        )}
      </div>
      <p className="mt-2 text-xs text-ink/55">Inclusive of all taxes · Free pickup at TurfXL</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-line">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="p-3 text-ink/75 hover:text-ink disabled:opacity-30"
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >
            <Minus size={15} />
          </button>
          <span className="w-9 text-center font-display text-xl text-ink" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            className="p-3 text-ink/75 hover:text-ink disabled:opacity-30"
            disabled={qty >= 20}
            aria-label="Increase quantity"
          >
            <Plus size={15} />
          </button>
        </div>

        <button type="button" onClick={onAdd} disabled={outOfStock} className={added ? "btn bg-volt text-ink" : "btn-outline"}>
          {added ? <Check size={16} /> : <ShoppingBag size={16} />}
          {added ? "Added to cart" : "Add to cart"}
        </button>

        <button type="button" onClick={onBuyNow} disabled={outOfStock} className="btn-volt">
          {outOfStock ? "Sold out" : "Buy now"}
        </button>
      </div>

      <p className={`mt-3 text-xs ${outOfStock ? "text-signal" : product.stock < 6 ? "text-volt-deep" : "text-volt-deep"}`}>
        {outOfStock
          ? "Out of stock — message a rep to be told when it lands."
          : product.stock < 6
            ? `Only ${product.stock} left in stock`
            : "In stock · ships or ready for pickup in 24 hours"}
      </p>

      <a
        href={waLink(`Hi Sparvic! I have a question about the ${product.name}.`)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-volt-deep hover:underline"
      >
        <MessageCircle size={15} /> Ask a representative about this product
      </a>
    </div>
  );
}
