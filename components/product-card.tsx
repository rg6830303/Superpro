"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { formatPaise } from "@/lib/money";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock <= 0;

  const onAdd = () => {
    add({
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      price_paise: product.price_paise,
      image_url: product.image_url,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article className="card-hover group flex flex-col overflow-hidden">
      <Link href={`/products/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-bone">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-2xl uppercase text-ink/30">
            {product.name}
          </div>
        )}
        {product.compare_at_paise && product.compare_at_paise > product.price_paise && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold">
            Save {formatPaise(product.compare_at_paise - product.price_paise)}
          </span>
        )}
        {outOfStock && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-bone/70">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">{product.category}</p>
        <h3 className="mt-1.5 text-xl">
          <Link href={`/products/${product.slug}`} className="hover:text-gold">
            {product.name}
          </Link>
        </h3>
        {product.tagline && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-bone/50">{product.tagline}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="font-display text-2xl text-bone">{formatPaise(product.price_paise)}</p>
            {product.compare_at_paise && product.compare_at_paise > product.price_paise && (
              <p className="text-xs text-bone/35 line-through">{formatPaise(product.compare_at_paise)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onAdd}
            disabled={outOfStock}
            className={`btn btn-sm ${added ? "bg-ok text-ink" : "bg-bone text-ink hover:bg-white"} disabled:bg-white/10 disabled:text-bone/40`}
            aria-label={`Add ${product.name} to cart`}
          >
            {added ? <Check size={14} /> : <Plus size={14} />}
            {added ? "Added" : outOfStock ? "Sold out" : "Add"}
          </button>
        </div>
      </div>
    </article>
  );
}
