import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { EmptyState, Reveal } from "@/components/ui";
import { getProducts } from "@/lib/queries";
import { PRODUCT_CATEGORIES, waLink } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Paddles, balls & grips",
  description:
    "The SuperPro Champion Series — Toray carbon paddles, outdoor and indoor balls, and grips built for Indian humidity. Pickup in Kolkata or delivered.",
};

const FILTERS = [{ slug: "", label: "Everything" }, ...PRODUCT_CATEGORIES.map((c) => ({ slug: c.slug, label: c.label }))];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const valid = PRODUCT_CATEGORIES.some((c) => c.slug === category) ? category : undefined;
  const products = await getProducts(valid);
  const active = PRODUCT_CATEGORIES.find((c) => c.slug === valid);

  return (
    <div className="wrap py-14">
      <p className="eyebrow">The shop</p>
      <h1 className="mt-3 text-[clamp(2.5rem,7vw,4.25rem)]">{active ? active.label : "Champion Series"}</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-bone/55">
        {active
          ? active.blurb
          : "Everything we put on our own courts. Pickup free at TurfXL, New Alipore — or delivered anywhere in Kolkata, free over ₹5,000."}
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = (f.slug || undefined) === valid;
          return (
            <Link
              key={f.slug || "all"}
              href={f.slug ? `/products?category=${f.slug}` : "/products"}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? "bg-gold text-ink" : "border border-white/15 text-bone/60 hover:border-gold/50 hover:text-gold"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-10">
        {products.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            sub="Stock is being loaded. Message a rep and we'll tell you exactly what's on the shelf right now."
            action={
              <a
                href={waLink("Hi SuperPro! What paddles do you have in stock?")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline btn-sm mt-2"
              >
                <MessageCircle size={14} /> Ask a rep
              </a>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 70}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      <div className="mt-14 card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <h2 className="text-3xl">Still deciding?</h2>
        <p className="max-w-md text-sm text-bone/55">
          Tell a rep your level, your grip size and your budget. They&apos;ll pick one paddle and tell you why.
        </p>
        <a
          href={waLink("Hi SuperPro! Help me pick a paddle — here's how I play:")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn bg-[#25D366] text-ink hover:brightness-110"
        >
          <MessageCircle size={16} /> Chat with a representative
        </a>
      </div>
    </div>
  );
}
