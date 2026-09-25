import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import {
  COACH_COOKIE,
  COACH_SESSION_MAX_AGE,
  secureCookieOptions,
  signToken,
  type CoachPayload,
} from "@/lib/auth";

export type CoachAccount = {
  id: string;
  coach_id: string;
  email: string;
  password_hash: string;
  name: string;
  active: boolean;
};

export function normaliseEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

/** Look a coach account up by email, with the coach's name and listing state. */
export async function findCoachAccount(email: string): Promise<CoachAccount | null> {
  return queryOne<CoachAccount>(
    `SELECT a.id, a.coach_id, a.email, a.password_hash, c.name, c.active
     FROM coach_accounts a JOIN coaches c ON c.id = a.coach_id
     WHERE a.email = $1 LIMIT 1`,
    [email],
  );
}

/**
 * The coach on the roster that this email belongs to, if any. This is the gate
 * on sign-up: a coach login can only be created for an email an admin has put
 * on a coach's profile, because a coach account can read client phone numbers.
 */
export async function findRosterCoach(email: string) {
  return queryOne<{ id: string; name: string; active: boolean; has_login: boolean }>(
    `SELECT c.id, c.name, c.active,
            EXISTS (SELECT 1 FROM coach_accounts a WHERE a.coach_id = c.id) AS has_login
     FROM coaches c WHERE lower(c.email) = $1 LIMIT 1`,
    [email],
  );
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function checkPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * A hash to compare against when the email is unknown, so a wrong email and a
 * wrong password take the same time and nobody can probe which coaches exist.
 */
const DECOY_HASH = "$2a$12$eH/p3KBIWvEPM.ECT.P8r.2i7hB/4X2eBYcEHs9JyHTyj7Ejh60ki";
export async function checkDecoy(password: string): Promise<void> {
  await bcrypt.compare(password, DECOY_HASH).catch(() => false);
}

export async function startCoachSession(account: { id: string; coach_id: string; email: string; name: string }) {
  const payload: CoachPayload = {
    id: account.id,
    coach_id: account.coach_id,
    email: account.email,
    name: account.name,
    role: "coach",
  };
  const token = await signToken(payload);
  (await cookies()).set(COACH_COOKIE, token, {
    ...secureCookieOptions,
    sameSite: "lax",
    maxAge: COACH_SESSION_MAX_AGE,
  });
  await query(`UPDATE coach_accounts SET last_login_at = now() WHERE id = $1`, [account.id]).catch(() => {});
}

export async function endCoachSession() {
  (await cookies()).delete(COACH_COOKIE);
}

/**
 * The coach session, but only if the login still exists and the coach is still
 * listed. A signed token stays valid for its whole lifetime on its own, so
 * without this a coach whose login the club revoked could keep reading client
 * details for up to a week.
 */
export async function liveCoachSession(): Promise<CoachPayload | null> {
  const { getCoachSession } = await import("@/lib/auth");
  const session = await getCoachSession();
  if (!session) return null;
  const ok = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM coach_accounts a JOIN coaches c ON c.id = a.coach_id
                    WHERE a.id = $1 AND a.coach_id = $2 AND c.active) AS ok`,
    [session.id, session.coach_id],
  ).catch(() => null);
  return ok?.ok ? session : null;
}
