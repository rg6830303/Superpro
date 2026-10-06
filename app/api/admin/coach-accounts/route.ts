import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { hashPassword } from "@/lib/coach-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** XXXX-XXXX-XXXX from an alphabet without look-alike characters. */
function newCode(): string {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const part = () => Array.from(randomBytes(4), (b) => a[b % a.length]).join("");
  return `${part()}-${part()}-${part()}`;
}

const body = z.discriminatedUnion("action", [
  // A fresh one-time code the coach uses at /coach/signup. Shown once; only its hash is kept.
  z.object({ action: z.literal("code"), coach_id: z.string().uuid() }),
  // Create the login directly, or reset the password (and optionally the email) of an existing one.
  z.object({
    action: z.literal("password"),
    coach_id: z.string().uuid(),
    email: z.string().trim().toLowerCase().email("Enter a valid email."),
    password: z.string().min(8, "Use at least 8 characters.").max(128),
  }),
]);

/**
 * Coach portal logins, managed from the admin console: issue a sign-up code,
 * create or reset a login, or remove it. Passwords are bcrypt-hashed in the
 * same database the portal signs in against.
 */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the details.");
  try {
    await ensureSchema();
    const d = parsed.data;
    const coach = await queryOne<{ id: string; name: string }>(`SELECT id, name FROM coaches WHERE id = $1`, [d.coach_id]);
    if (!coach) return badRequest("That coach no longer exists.");

    if (d.action === "code") {
      const code = newCode();
      await query(`UPDATE coaches SET invite_code_hash = $1 WHERE id = $2`, [createHash("sha256").update(code).digest("hex"), coach.id]);
      await audit(gate, "coach.code", "coaches", coach.id);
      return NextResponse.json({ ok: true, code });
    }

    const taken = await queryOne<{ coach_id: string }>(`SELECT coach_id FROM coach_accounts WHERE email = $1`, [d.email]);
    if (taken && taken.coach_id !== coach.id) return badRequest("That email already belongs to another coach's login.");
    const hash = await hashPassword(d.password);
    await query(
      `INSERT INTO coach_accounts (coach_id, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (coach_id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
      [coach.id, d.email, hash],
    );
    // The login exists now, so an outstanding sign-up code is no longer needed.
    await query(`UPDATE coaches SET email = $1, invite_code_hash = NULL WHERE id = $2`, [d.email, coach.id]);
    await audit(gate, "coach.login.set", "coaches", coach.id, { email: d.email });
    return NextResponse.json({ ok: true, message: `Login saved for ${coach.name}. They can sign in at /coach/login on the demo site.` });
  } catch (err) {
    return serverError("coach-accounts:post", err);
  }
}

/** Remove a coach's portal login (the coach profile and their data stay). */
export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const coachId = new URL(req.url).searchParams.get("coach_id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(coachId)) return badRequest("Missing coach.");
  try {
    await query(`DELETE FROM coach_accounts WHERE coach_id = $1`, [coachId]);
    await query(`UPDATE coaches SET invite_code_hash = NULL WHERE id = $1`, [coachId]);
    await audit(gate, "coach.login.delete", "coaches", coachId);
    return NextResponse.json({ ok: true, message: "Login removed. Issue a new code or set a password to give access again." });
  } catch (err) {
    return serverError("coach-accounts:delete", err);
  }
}
