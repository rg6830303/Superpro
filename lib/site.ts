/**
 * Brand + contact constants. Anything an operator might want to change without
 * a code edit lives in the `settings` table instead (see lib/settings.ts) —
 * these are the compile-time defaults and the values the marketing copy uses.
 */
export const SITE = {
  name: "SuperPro",
  legalName: "SuperPro Sports",
  tagline: "Pickleball, played properly.",
  description:
    "SuperPro is Kolkata's pickleball house — Champion Series paddles, balls and grips, daily open games, coaching with certified pros, and the tournaments we run and sponsor.",
  city: "Kolkata",
  email: "hello@superpro.in",
  instagram: "https://instagram.com/superpro.pickleball",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://superpro.in",
} as const;

/** Sales/support rep — powers every "Chat with a rep" WhatsApp button. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919830000000").replace(
  /\D/g,
  "",
);

/** Public invite link to the daily-games WhatsApp group. */
export const WHATSAPP_GROUP_URL = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ?? "";

/** Build a wa.me deep link with a pre-filled message. */
export function waLink(message: string, phone: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/products", label: "Shop" },
  { href: "/games", label: "Daily Games" },
  { href: "/coaching", label: "Coaching" },
  { href: "/tournaments", label: "Tournaments" },
] as const;

export const PRODUCT_CATEGORIES = [
  { slug: "paddles", label: "Paddles", blurb: "Toray carbon faces, honeycomb cores, tuned in Kolkata." },
  { slug: "balls", label: "Balls", blurb: "Outdoor 40-hole balls that survive an Indian summer." },
  { slug: "grips", label: "Grips", blurb: "Overgrips and bands built for humidity and long rallies." },
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["slug"];
