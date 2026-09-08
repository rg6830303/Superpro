import { query, queryOne, withTimeout } from "@/lib/db";
import { findAuthUserByEmail, isSupabaseAdminConfigured, supabaseAdmin, supabaseAuth } from "@/lib/supabase";

/**
 * Account plumbing shared by the customer site and the admin console.
 *
 * Supabase Auth holds the credentials; the `users` table holds the app-level
 * profile (name, phone, skill, role, wallet) and is keyed on the SAME id as
 * `auth.users`, so every foreign key in the app (orders, bookings, wallet)
 * points at one row per human.
 */

/** Staff sign in with a username; Supabase needs an email, so map one to the other. */
export const ADMIN_EMAIL_DOMAIN = process.env.ADMIN_EMAIL_DOMAIN ?? "superpro.in";

export function normaliseLoginEmail(input: string): string {
  const value = input.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${ADMIN_EMAIL_DOMAIN}`;
}

export type UserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  skill_level: string;
  dupr: number | null;
  dupr_id: string | null;
  city: string | null;
  role: "player" | "staff" | "admin";
  wallet_balance_paise: number;
  avatar_url: string | null;
  whatsapp_opt_in: boolean;
  created_at: string;
};

export async function getUserRow(id: string): Promise<UserRow | null> {
  return withTimeout(
    "getUserRow",
    () => queryOne<UserRow>(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]),
    null,
  );
}

export async function getUserRowByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [email.toLowerCase()]).catch(
    () => null,
  );
}

/**
 * Create or refresh the app-level row for a Supabase auth user. Called on
 * signup AND on every login, so an account created directly in the Supabase
 * dashboard still works the first time it signs in here.
 */
export async function syncUserRow(input: {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  skill_level?: string | null;
  dupr?: number | null;
  dupr_id?: string | null;
  role?: "player" | "staff" | "admin";
}): Promise<UserRow | null> {
  const email = input.email.toLowerCase();
  const fullName = input.full_name?.trim() || email.split("@")[0];

  try {
    await query(
      `INSERT INTO users (id, email, full_name, phone, skill_level, dupr, dupr_id, role,
         auth_provider, password_hash)
       VALUES ($1,$2,$3,$4,COALESCE($5,'beginner'),$6,$7,COALESCE($8,'player'),'supabase',NULL)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name),
         phone = COALESCE(EXCLUDED.phone, users.phone),
         skill_level = COALESCE(EXCLUDED.skill_level, users.skill_level),
         dupr = COALESCE(EXCLUDED.dupr, users.dupr),
         dupr_id = COALESCE(EXCLUDED.dupr_id, users.dupr_id),
         role = CASE WHEN EXCLUDED.role = 'admin' THEN 'admin' ELSE users.role END,
         last_login_at = now(),
         updated_at = now()`,
      [
        input.id,
        email,
        fullName,
        input.phone ?? null,
        input.skill_level ?? null,
        input.dupr ?? null,
        input.dupr_id ?? null,
        input.role ?? null,
      ],
    );
  } catch (err) {
    // A pre-Supabase row may still occupy this email with a different id.
    // Re-point it at the auth id rather than leaving the player locked out.
    console.error("[accounts] syncUserRow insert failed, trying email merge:", err instanceof Error ? err.message : err);
    await query(
      `UPDATE users SET id = $1, auth_provider = 'supabase', password_hash = NULL, updated_at = now()
       WHERE email = $2`,
      [input.id, email],
    ).catch((e) => console.error("[accounts] email merge failed:", e instanceof Error ? e.message : e));
  }

  return getUserRow(input.id);
}

export type AuthResult =
  | { ok: true; id: string; email: string; metadata: Record<string, unknown> }
  | { ok: false; error: string; status: number };

/** Verify credentials against Supabase Auth. */
export async function verifyCredentials(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabaseAuth().auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, error: "Invalid email or password.", status: 401 };
    }
    return {
      ok: true,
      id: data.user.id,
      email: data.user.email ?? email,
      metadata: { ...(data.user.user_metadata ?? {}), ...(data.user.app_metadata ?? {}) },
    };
  } catch (err) {
    console.error("[accounts] verifyCredentials:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Sign-in is temporarily unavailable.", status: 503 };
  }
}

/** Create a Supabase auth user. Email confirmation is skipped — the club verifies on WhatsApp. */
export async function createAuthUser(input: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  skill_level?: string;
  role?: "player" | "staff" | "admin";
}): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  if (!isSupabaseAdminConfigured) {
    return { ok: false, error: "Account creation is not configured on the server.", status: 503 };
  }

  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name,
      phone: input.phone ?? null,
      skill_level: input.skill_level ?? "beginner",
    },
    app_metadata: { role: input.role ?? "player" },
  });

  if (error) {
    const message = error.message ?? "";
    if (/already registered|already been registered|duplicate/i.test(message)) {
      return { ok: false, error: "An account with that email already exists. Sign in instead.", status: 409 };
    }
    console.error("[accounts] createAuthUser:", message);
    return { ok: false, error: "Could not create the account. Please try again.", status: 500 };
  }

  return { ok: true, id: data.user.id };
}

/**
 * Ensure the owner account exists so the console is reachable on a fresh
 * project. Runs on the admin login path only, and only when the submitted
 * credentials match the configured bootstrap pair.
 */
export async function ensureAdminAccount(email: string, password: string): Promise<string | null> {
  if (!isSupabaseAdminConfigured) return null;

  const existing = await findAuthUserByEmail(email);
  if (existing) {
    // Keep the password and role in step with the configured bootstrap values.
    await supabaseAdmin()
      .auth.admin.updateUserById(existing.id, { password, app_metadata: { role: "admin" } })
      .catch((err) => console.error("[accounts] admin password sync failed:", err));
    await syncUserRow({ id: existing.id, email, full_name: "SuperPro Admin", role: "admin" });
    return existing.id;
  }

  const created = await createAuthUser({
    email,
    password,
    full_name: "SuperPro Admin",
    role: "admin",
  });
  if (!created.ok) {
    console.error("[accounts] admin bootstrap failed:", created.error);
    return null;
  }
  await syncUserRow({ id: created.id, email, full_name: "SuperPro Admin", role: "admin" });
  return created.id;
}

/** True when this account may open the admin console. */
export async function isAdminAccount(id: string, metadata: Record<string, unknown>): Promise<boolean> {
  if (metadata.role === "admin" || metadata.role === "staff") return true;
  const row = await getUserRow(id);
  if (row && (row.role === "admin" || row.role === "staff")) return true;
  const legacy = await queryOne<{ id: string }>(
    `SELECT id FROM admins WHERE id::text = $1 OR email = (SELECT email FROM users WHERE id = $1) LIMIT 1`,
    [id],
  ).catch(() => null);
  return Boolean(legacy);
}
