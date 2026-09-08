import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const DEV_FALLBACK = "superpro-dev-only-secret-change-me-64-chars-long-or-more-please";

function loadSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET ?? process.env.JWT_SECRET;
  if (raw && raw.length >= 32) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be at least 32 chars in production. Generate one with: openssl rand -hex 32",
    );
  }
  return new TextEncoder().encode(DEV_FALLBACK);
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
    .sign(loadSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    // Pin the algorithm — without this a token forged with alg:"none" would be
    // accepted (alg-confusion attack).
    const { payload } = await jwtVerify(token, loadSecret(), { algorithms: ["HS256"] });
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
