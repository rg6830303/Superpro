import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE } from "@/lib/site";
import { surfaceOfHost } from "@/lib/surface";

/**
 * The main domain is open to search engines and AI crawlers (they are how
 * people find the club by asking); private areas stay out. The demo host is
 * never indexed.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (surfaceOfHost((await headers()).get("host")) === "demo") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const privateAreas = ["/admin", "/dashboard", "/coach", "/api/", "/checkout", "/cart", "/order/", "/reset-password", "/design-review"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privateAreas },
      ...["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "Bingbot"].map((ua) => ({
        userAgent: ua,
        allow: "/",
        disallow: privateAreas,
      })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
