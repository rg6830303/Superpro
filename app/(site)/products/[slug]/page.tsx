import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductBuyBox, ProductGallery } from "@/components/product-buy-box";
import { ProductCard } from "@/components/product-card";
import { getProductBySlug, getRelatedProducts } from "@/lib/queries";
import { formatPaise } from "@/lib/money";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.tagline ?? product.description ?? SITE.description,
    openGraph: product.image_url ? { images: [{ url: product.image_url }] } : undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product.category, product.slug, 3);
  const specs = Array.isArray(product.specs) ? product.specs : [];

  return (
    <div className="wrap py-10">
      <Link
        href={`/products?category=${product.category}`}
        className="inline-flex items-center gap-1.5 text-sm text-bone/50 hover:text-gold"
      >
        <ChevronLeft size={16} /> All {product.category}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductGallery product={product} />

        <div>
          <p className="eyebrow">{product.category}</p>
          <h1 className="mt-3 text-[clamp(2.25rem,5vw,3.5rem)]">{product.name}</h1>
          {product.tagline && <p className="mt-4 text-lg leading-relaxed text-bone/65">{product.tagline}</p>}

          <ProductBuyBox product={product} />

          {product.description && (
            <div className="mt-9 border-t border-white/10 pt-7">
              <h2 className="text-xl">The detail</h2>
              <p className="mt-3 text-sm leading-relaxed text-bone/55">{product.description}</p>
            </div>
          )}

          {specs.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-7">
              <h2 className="text-xl">Specification</h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {specs.map((s) => (
                  <li key={s} className="flex items-start gap-2.5 text-sm text-bone/60">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-7 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-bone/40">Pickup</dt>
              <dd className="mt-1 text-bone/70">Free at TurfXL, New Alipore</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-bone/40">Delivery</dt>
              <dd className="mt-1 text-bone/70">₹99 in Kolkata · free over {formatPaise(500000)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-3xl">More {product.category}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
