import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserRow } from "@/lib/accounts";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { listWalletTransactions } from "@/lib/wallet";
import { phoneSchema } from "@/lib/validation";
import { normaliseDuprId, skillFromDupr } from "@/lib/dupr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80).optional(),
  phone: phoneSchema.optional(),
  city: z.string().trim().max(60).optional(),
  dupr: z.number().min(2).max(8).nullable().optional(),
  dupr_id: z.string().trim().max(24).optional(),
  whatsapp_opt_in: z.boolean().optional(),
});

/**
 * Never echo internal auth columns back to the browser — the row carries a
 * legacy `password_hash` column that must not leave the server.
 */
function publicProfile(row: Record<string, unknown>) {
  const { password_hash: _ignored, auth_provider: _provider, ...safe } = row;
  return safe;
}

export async function GET() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  await ensureSchema();
  const profile = await getUserRow(session.id);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const transactions = await listWalletTransactions(session.id, 20);
  return NextResponse.json({ profile: publicProfile(profile), transactions });
}

export async function PATCH(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details." }, { status: 400 });
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await ensureSchema();

  // The category is derived from the rating, so it is never accepted from the
  // client. Explicit column list — a player cannot patch their role or wallet.
  const skillLevel = patch.dupr != null ? skillFromDupr(patch.dupr) : null;

  await query(
    `UPDATE users SET
       full_name = COALESCE($1, full_name),
       phone = COALESCE($2, phone),
       skill_level = COALESCE($3, skill_level),
       city = COALESCE($4, city),
       dupr = COALESCE($5, dupr),
       dupr_id = COALESCE($6, dupr_id),
       whatsapp_opt_in = COALESCE($7, whatsapp_opt_in),
       updated_at = now()
     WHERE id = $8`,
    [
      patch.full_name ?? null,
      patch.phone ?? null,
      skillLevel,
      patch.city ?? null,
      patch.dupr ?? null,
      normaliseDuprId(patch.dupr_id),
      patch.whatsapp_opt_in ?? null,
      session.id,
    ],
  );

  const updated = await getUserRow(session.id);
  return NextResponse.json({ ok: true, profile: updated ? publicProfile(updated) : null });
}
