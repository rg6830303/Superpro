import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getProducts, getTournaments } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Every public page on the main domain, with the shop and tournaments. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });
  const [products, tournaments] = await Promise.all([getProducts().catch(() => []), getTournaments().catch(() => [])]);
  return [
    page("/", 1, "daily"),
    page("/games", 0.9, "daily"),
    page("/sparvic-open", 0.9, "daily"),
    page("/tournaments", 0.8),
    page("/coaching", 0.8),
    page("/coaching/ishaan-chetani", 0.7),
    page("/products", 0.8),
    page("/medical", 0.6),
    page("/about", 0.6, "monthly"),
    page("/intro", 0.5, "monthly"),
    page("/signup", 0.5, "monthly"),
    ...products.map((p) => page(`/products/${p.slug}`, 0.6)),
    ...tournaments.map((t) => page(`/tournaments/${t.slug}`, 0.6)),
  ];
}
