import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { createAuthUser, getUserRow, syncUserRow } from "@/lib/accounts";
import { query, queryOne } from "@/lib/db";
import { normaliseDuprId, skillFromDupr } from "@/lib/dupr";
import { emailSchema, phoneSchema } from "@/lib/validation";
import { findAuthUserByEmail, isSupabaseAdminConfigured, supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Full account management for the console: list, create, edit and delete
 * players. Accounts live in Supabase Auth, so every write here touches both
 * sides — the auth user (email, password, role) and the app row (profile,
 * wallet). Deleting removes both, so a deleted player cannot sign back in.
 */

const createSchema = z.object({
  full_name: z.string().trim().min(2, "Enter a full name").max(80),
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  phone: phoneSchema.optional().or(z.literal("")),
  dupr: z.number().min(2).max(8).nullable().optional(),
  dupr_id: z.string().trim().max(24).optional(),
  city: z.string().trim().max(60).optional(),
  role: z.enum(["player", "staff", "admin"]).default("player"),
  wallet_rupees: z.number().min(0).max(500000).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  dupr: z.number().min(2).max(8).nullable().optional(),
  dupr_id: z.string().trim().max(24).nullable().optional(),
  city: z.string().trim().max(60).optional(),
  role: z.enum(["player", "staff", "admin"]).optional(),
  whatsapp_opt_in: z.boolean().optional(),
  /** Setting this resets the Supabase Auth password for the account. */
  password: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
  email: emailSchema.optional(),
});

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const q = new URL(req.url).searchParams.get("q");
    const users = await query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.skill_level, u.dupr, u.dupr_id, u.city,
              u.role, u.wallet_balance_paise::int AS wallet_balance_paise, u.whatsapp_opt_in,
              u.created_at, u.last_login_at,
              COALESCE((SELECT COUNT(*) FROM game_registrations r
                        WHERE (r.user_id = u.id OR r.player_phone = u.phone)
                          AND r.status <> 'cancelled'), 0)::int AS games,
              COALESCE((SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id), 0)::int AS orders
       FROM users u
       WHERE ($1::text IS NULL OR u.full_name ILIKE '%' || $1 || '%'
              OR u.email ILIKE '%' || $1 || '%' OR u.phone ILIKE '%' || $1 || '%')
       ORDER BY u.created_at DESC
       LIMIT 300`,
      [q],
    );
    return NextResponse.json({ users });
  } catch (err) {
    return serverError("users:list", err);
  }
}

export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    if (!isSupabaseAdminConfigured) {
      return badRequest("Supabase service role key is not configured, so accounts cannot be created.");
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid details.");
    const input = parsed.data;

    const existing = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [input.email]);
    if (existing) return badRequest("An account with that email already exists.");

    const created = await createAuthUser({
      email: input.email,
      password: input.password,
      full_name: input.full_name,
      phone: input.phone || undefined,
      skill_level: skillFromDupr(input.dupr),
      role: input.role,
    });
    if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });

    await syncUserRow({
      id: created.id,
      email: input.email,
      full_name: input.full_name,
      phone: input.phone || null,
      skill_level: skillFromDupr(input.dupr),
      dupr: input.dupr ?? null,
      dupr_id: normaliseDuprId(input.dupr_id),
      role: input.role,
    });

    if (input.city) {
      await query(`UPDATE users SET city = $1 WHERE id = $2`, [input.city, created.id]);
    }

    // Opening balance, if the admin set one, goes through the ledger like any
    // other movement so the wallet history is complete from day one.
    if (input.wallet_rupees && input.wallet_rupees > 0) {
      const { adjustWallet } = await import("@/lib/wallet");
      await adjustWallet({
        userId: created.id,
        deltaPaise: Math.round(input.wallet_rupees * 100),
        kind: "topup",
        reason: "Opening balance set at account creation",
        createdBy: gate.email,
      });
    }

    await audit(gate, "user.create", "users", created.id, { email: input.email, role: input.role });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    return serverError("users:create", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid details.");
    const { id, password, email, ...patch } = parsed.data;

    const current = await getUserRow(id);
    if (!current) return badRequest("That account no longer exists.");

    // Category is always derived from the rating, never set directly.
    const skillLevel = patch.dupr !== undefined ? skillFromDupr(patch.dupr) : null;

    await query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         dupr = CASE WHEN $3::boolean THEN $4 ELSE dupr END,
         dupr_id = CASE WHEN $5::boolean THEN $6 ELSE dupr_id END,
         skill_level = COALESCE($7, skill_level),
         city = COALESCE($8, city),
         role = COALESCE($9, role),
         whatsapp_opt_in = COALESCE($10, whatsapp_opt_in),
         email = COALESCE($11, email),
         updated_at = now()
       WHERE id = $12`,
      [
        patch.full_name ?? null,
        patch.phone ?? null,
        patch.dupr !== undefined,
        patch.dupr ?? null,
        patch.dupr_id !== undefined,
        patch.dupr_id ? normaliseDuprId(patch.dupr_id) : null,
        skillLevel,
        patch.city ?? null,
        patch.role ?? null,
        patch.whatsapp_opt_in ?? null,
        email ?? null,
        id,
      ],
    );

    // Mirror credential + role changes into Supabase Auth, or the account would
    // still sign in with the old password.
    if ((password || email || patch.role) && isSupabaseAdminConfigured) {
      const payload: Record<string, unknown> = {};
      if (password) payload.password = password;
      if (email) payload.email = email;
      if (patch.role) payload.app_metadata = { role: patch.role };
      const { error } = await supabaseAdmin().auth.admin.updateUserById(id, payload);
      if (error) {
        console.error("[users:update] supabase sync failed:", error.message);
        return NextResponse.json(
          { error: `Profile saved, but the sign-in details could not be updated: ${error.message}` },
          { status: 502 },
        );
      }
    }

    await audit(gate, "user.update", "users", id, {
      fields: Object.keys(patch),
      password_reset: Boolean(password),
    });
    return NextResponse.json({ ok: true, user: await getUserRow(id) });
  } catch (err) {
    return serverError("users:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing account id.");

    const target = await getUserRow(id);
    if (!target) return badRequest("That account no longer exists.");
    if (target.email === gate.email) return badRequest("You cannot delete the account you are signed in as.");

    // Bookings and orders keep their history: the foreign keys are ON DELETE
    // SET NULL, so the records survive as guest rows with the name intact.
    await query(`DELETE FROM wallet_transactions WHERE user_id = $1`, [id]);
    await query(`DELETE FROM users WHERE id = $1`, [id]);

    if (isSupabaseAdminConfigured) {
      const authUser = await findAuthUserByEmail(target.email);
      if (authUser) {
        const { error } = await supabaseAdmin().auth.admin.deleteUser(authUser.id);
        if (error) console.error("[users:delete] supabase delete failed:", error.message);
      }
    }

    await audit(gate, "user.delete", "users", id, { email: target.email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("users:delete", err);
  }
}
