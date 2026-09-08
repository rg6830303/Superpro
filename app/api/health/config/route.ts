import { NextResponse } from "next/server";
import { hasSigningSecret, signingSecretSource } from "@/lib/auth";
import { dbConnInfo } from "@/lib/db";
import { isRazorpayEnabled } from "@/lib/razorpay";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase";
import { whatsappConfig } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment checklist. Reports whether each variable is PRESENT — never its
 * value, never a fragment of one — so it is safe to open in a browser while
 * setting a project up. A missing `required` entry means that feature is dead
 * in this deployment.
 */
export async function GET() {
  const has = (name: string) => Boolean(process.env[name]?.trim());


  const required = {
    POSTGRES_URL: has("POSTGRES_URL"),
    NEXT_PUBLIC_SUPABASE_URL: has("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: has("SUPABASE_SERVICE_ROLE_KEY"),
    // Sessions can also be signed from a derived Supabase secret, so report
    // whether signing WORKS, not merely whether the variable is set.
    SESSION_SIGNING: hasSigningSecret(),
  };

  const optional = {
    SESSION_SECRET_EXPLICIT: has("SESSION_SECRET"),
    ADMIN_USERNAME: has("ADMIN_USERNAME"),
    ADMIN_PASSWORD: has("ADMIN_PASSWORD"),
    NEXT_PUBLIC_ADMIN_HOST: has("NEXT_PUBLIC_ADMIN_HOST"),
    NEXT_PUBLIC_SITE_URL: has("NEXT_PUBLIC_SITE_URL"),
    SEED_TOKEN: has("SEED_TOKEN"),
    CRON_SECRET: has("CRON_SECRET"),
    NEXT_PUBLIC_WHATSAPP_NUMBER: has("NEXT_PUBLIC_WHATSAPP_NUMBER"),
    RAZORPAY: isRazorpayEnabled,
  };

  const missing = Object.entries(required)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  return NextResponse.json(
    {
      ok: missing.length === 0,
      missing,
      required,
      optional,
      signing_key: signingSecretSource(),
      surface: process.env.NEXT_PUBLIC_ADMIN_HOST ? "admin" : "public",
      db: dbConnInfo(),
      supabase: { auth: isSupabaseConfigured, adminApi: isSupabaseAdminConfigured },
      whatsapp: whatsappConfig,
    },
    { status: missing.length === 0 ? 200 : 503 },
  );
}
