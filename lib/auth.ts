import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const DEV_FALLBACK = "superpro-dev-only-secret-change-me-64-chars-long-or-more-please";

/**
 * Cookie signing key.
 *
 * SESSION_SECRET is the intended source. When it is absent we DERIVE a key from
 * a Supabase secret the deployment already holds, rather than refusing to sign —
 * one unset variable should not take every login on the site offline. Derivation
 * runs the material through SHA-256 with a domain-separation prefix, so the
 * Supabase secret is never used directly as the HMAC key and cannot be
 * recovered from an issued cookie.
 *
 * Still set SESSION_SECRET when you can: it lets you rotate every session
 * without touching the Supabase credentials.
 */
function secretSource(): { source: "session-secret" | "derived" | "dev" | "none"; material: string } {
  const explicit = process.env.SESSION_SECRET ?? process.env.JWT_SECRET;
  if (explicit && explicit.length >= 32) return { source: "session-secret", material: explicit };

  const derived =
    process.env.SUPABASE_JWT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    "";
  if (derived.length >= 32) return { source: "derived", material: derived };

  if (process.env.NODE_ENV !== "production") return { source: "dev", material: DEV_FALLBACK };
  return { source: "none", material: "" };
}

/** True when a session cookie can actually be signed in this deployment. */
export function hasSigningSecret(): boolean {
  return secretSource().source !== "none";
}

/** Which tier of the chain is in use — surfaced by /api/health/config. */
export function signingSecretSource(): string {
  return secretSource().source;
}

// The middleware runs on the Edge runtime, so derivation uses Web Crypto rather
// than node:crypto — the same code then works in both runtimes. The derived key
// is cached because it never changes for the life of the process.
let derivedKey: Uint8Array | null = null;

async function loadSecret(): Promise<Uint8Array> {
  const { source, material } = secretSource();
  if (source === "none") {
    throw new Error(
      "No session signing secret. Set SESSION_SECRET (32+ chars), or SUPABASE_SERVICE_ROLE_KEY, in the environment.",
    );
  }
  if (source === "session-secret") return new TextEncoder().encode(material);

  if (!derivedKey) {
    const bytes = new TextEncoder().encode(`superpro:session:v1:${material}`);
    derivedKey = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  }
  return derivedKey;
}

export const PLAYER_COOKIE = "superpro_player_session";
export const ADMIN_COOKIE = "superpro_admin_session";

export type PlayerPayload = { id: string; email: string; name: string; role: "user" };
export type AdminPayload = { id: string; email: string; name: string; role: "admin" };
export type SessionPayload = PlayerPayload | AdminPayload;

// The JWT `exp` and the cookie `maxAge` MUST agree, so both always come from
// here rather than from literals scattered across the auth routes.
export const PLAYER_JWT_EXP = "7d";
export const PLAYER_SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const ADMIN_JWT_EXP = "12h";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export async function signToken(
  payload: SessionPayload,
  expiresIn: string = payload.role === "admin" ? ADMIN_JWT_EXP : PLAYER_JWT_EXP,
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(await loadSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    // Pin the algorithm — without this a token forged with alg:"none" would be
    // accepted (alg-confusion attack).
    const { payload } = await jwtVerify(token, await loadSecret(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getPlayerSession(): Promise<PlayerPayload | null> {
  const token = (await cookies()).get(PLAYER_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.role === "user" ? (payload as PlayerPayload) : null;
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.role === "admin" ? (payload as AdminPayload) : null;
}

/** Guard for admin API routes: returns the session or throws a 401 Response. */
export async function requireAdmin(): Promise<AdminPayload> {
  const session = await getAdminSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return session;
}

export const secureCookieOptions = {
  httpOnly: true as const,
  path: "/" as const,
  secure: process.env.NODE_ENV === "production",
};
