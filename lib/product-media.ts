import type { Product, ProductMedia } from "@/lib/types";

export const MAX_PRODUCT_MEDIA = 20;

/**
 * A product's photos and videos in display order. Rows saved before media
 * existed fall back to the old cover + gallery images, so every product reads
 * the same way.
 */
export function productMedia(p: Pick<Product, "image_url" | "gallery"> & { media?: unknown }): ProductMedia[] {
  const media = Array.isArray(p.media) ? (p.media as unknown[]) : [];
  const clean = media
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : null))
    .filter((m): m is Record<string, unknown> => !!m && typeof m.url === "string" && m.url.length > 0)
    .map((m) => ({ type: m.type === "video" ? ("video" as const) : ("image" as const), url: String(m.url), alt: typeof m.alt === "string" ? m.alt : null }));
  if (clean.length > 0) return clean;
  const gallery = Array.isArray(p.gallery) ? p.gallery : [];
  return [...new Set([p.image_url, ...gallery].filter((u): u is string => typeof u === "string" && u.length > 0))].map((url) => ({ type: "image", url }));
}

/** Validate media sent by the admin console; returns the cleaned list or an error. */
export function parseMedia(input: unknown): { ok: true; media: ProductMedia[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Media must be a list." };
  if (input.length > MAX_PRODUCT_MEDIA) return { ok: false, error: `Up to ${MAX_PRODUCT_MEDIA} photos and videos per product.` };
  const out: ProductMedia[] = [];
  for (const raw of input) {
    const m = raw as Record<string, unknown>;
    const url = typeof m?.url === "string" ? m.url.trim() : "";
    if (!/^https:\/\/\S+$/.test(url) && !url.startsWith("/")) return { ok: false, error: "Every photo and video needs a valid link." };
    if (m.type !== "image" && m.type !== "video") return { ok: false, error: "Media must be a photo or a video." };
    out.push({ type: m.type, url, alt: typeof m.alt === "string" ? m.alt.slice(0, 160) : null });
  }
  return { ok: true, media: out };
}

/** The old columns, derived from media: first photo is the cover, the rest the gallery. */
export function legacyColumns(media: ProductMedia[]): { image_url: string | null; gallery: string[] } {
  const images = media.filter((m) => m.type === "image").map((m) => m.url);
  return { image_url: images[0] ?? null, gallery: images.slice(1) };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
