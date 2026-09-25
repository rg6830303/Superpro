import { query } from "@/lib/db";
import { getClientIp } from "@/lib/rate-limit";

export type AccountEventKind = "signup" | "login" | "login_failed" | "logout";
export type ActorType = "player" | "coach";

/**
 * Record a sign-up, sign-in (or failed attempt) or sign-out, for the admin
 * console's activity monitor. `last_login_at` alone only ever shows the most
 * recent visit; this keeps the history, which is what makes it possible to
 * see who is active, and to spot someone guessing passwords.
 *
 * Never throws: an account must never fail to sign in because logging did.
 * Awaited by callers, since serverless functions can freeze once they respond.
 */
export async function recordAccountEvent(input: {
  req?: Request;
  actorType: ActorType;
  actorId?: string | null;
  email: string;
  name?: string | null;
  kind: AccountEventKind;
}): Promise<void> {
  const ip = input.req ? getClientIp(input.req) : null;
  const agent = input.req?.headers.get("user-agent")?.slice(0, 180) ?? null;
  await query(
    `INSERT INTO account_events (actor_type, actor_id, email, name, kind, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.actorType, input.actorId ?? null, input.email.toLowerCase().slice(0, 200), input.name ?? null, input.kind, ip, agent],
  ).catch((err) => console.error("[activity] record failed:", err instanceof Error ? err.message : err));
}
