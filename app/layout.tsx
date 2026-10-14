import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import { IntroGate } from "@/components/boot-cover";
import { CartProvider } from "@/components/cart-provider";
import { ThemedPickers } from "@/components/themed-pickers";
import { SITE } from "@/lib/site";
import { SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE, organizationLd, websiteLd } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";

/**
 * Three faces, three jobs: Archivo sets headlines with a wide grotesque cut,
 * Public Sans carries running text, and Plex Mono handles labels, scores and
 * every number the club reads off a screen.
 */
const display = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const sans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SEO_TITLE,
    template: `%s · ${SITE.name}`,
  },
  description: SEO_DESCRIPTION,
  applicationName: SITE.name,
  keywords: SEO_KEYWORDS,
  category: "sports",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  other: { "geo.region": "IN-WB", "geo.placename": "Kolkata" },
  icons: {
    icon: [
      { url: "/icons/icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    url: SITE.url,
    locale: "en_IN",
    images: [{ url: "/og-sparvic.png", width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    images: ["/og-sparvic.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  // Never trap the reader at one zoom level — pinch-zoom stays available, which
  // is also an accessibility requirement.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {/* Razorpay's checkout script is fetched from these two hosts the moment
            a payment page mounts. Opening the DNS/TLS connections up front takes
            a noticeable slice off how long the payment window takes to appear on
            a phone, and costs nothing when nobody checks out. */}
        <link rel="preconnect" href="https://checkout.razorpay.com" crossOrigin="" />
        <link rel="preconnect" href="https://api.razorpay.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />
        {/* Blocking on purpose: it must settle before the first paint, and it
            is a few lines that touch one attribute. */}
        <IntroGate />
      </head>
      <body>
        <CartProvider>{children}</CartProvider>
        <ThemedPickers />
        <JsonLd data={[organizationLd(), websiteLd()]} />
      </body>
    </html>
  );
}
