import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Auth is the identity provider for BOTH surfaces:
 *
 *   - the customer site (players sign up / sign in)
 *   - the admin console (staff sign in with a username that maps to an email)
 *
 * Passwords live in Supabase `auth.users` — this app never stores or compares a
 * password hash of its own. After Supabase verifies the credentials we mint a
 * short signed session cookie (lib/auth.ts) so the Edge middleware can gate
 * routes without a database round trip, and so the two Vercel domains keep
 * completely separate sessions.
 *
 * Row data (profile, wallet, bookings) stays in our own Postgres tables, keyed
 * on the Supabase auth user id.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

export const isSupabaseConfigured = Boolean(URL && ANON_KEY);
export const isSupabaseAdminConfigured = Boolean(URL && SERVICE_KEY);

let anonClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * Anon-key client used server-side purely to verify credentials
 * (`signInWithPassword`). Sessions are never persisted here — we issue our own
 * cookie instead — so every call is stateless and safe to share.
 */
export function supabaseAuth(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (!anonClient) {
    anonClient = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return anonClient;
}

/**
 * Service-role client — creates users, resets passwords, reads the auth
 * directory. SERVER ONLY: this key bypasses row-level security, so it must
 * never be imported into a client component.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!isSupabaseAdminConfigured) {
    throw new Error("Supabase admin is not configured: set SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!adminClient) {
    adminClient = createClient(URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}

/** Find an auth user by email without paging the whole directory client-side. */
export async function findAuthUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  if (!isSupabaseAdminConfigured) return null;
  const admin = supabaseAdmin();
  // listUsers has no server-side email filter, so page until we find it. The
  // directory is small (a club), and this only runs on signup/bootstrap paths.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[supabase] listUsers failed:", error.message);
      return null;
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return { id: match.id, email: match.email ?? email };
    if (data.users.length < 200) break;
  }
  return null;
}

export const supabaseStatus = {
  configured: isSupabaseConfigured,
  adminConfigured: isSupabaseAdminConfigured,
  url: URL ? URL.replace(/^https:\/\/([^.]+)\..*$/, "$1") : null, // project ref only, never the key
};
