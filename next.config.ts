import type { NextConfig } from "next";
import path from "node:path";

/**
 * Content-Security-Policy — defence in depth against XSS/clickjacking.
 * Allows exactly the origins the app needs: Razorpay checkout, Google Fonts,
 * Google Maps embed, and https images (Supabase Storage product uploads).
 *
 * `next dev` compiles client modules with eval()-based HMR, which a strict
 * script-src blocks and silently kills hydration — so 'unsafe-eval' is allowed
 * in development ONLY. Production stays strict.
 */
const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "",
  "https://checkout.razorpay.com https://*.razorpay.com",
]
  .filter(Boolean)
  .join(" ");

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  scriptSrc,
  "connect-src 'self' https:",
  "frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://*.razorpay.com https://www.google.com",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
