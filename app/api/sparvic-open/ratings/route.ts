import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const runtime = "nodejs";

const rating = z.union([z.coerce.number().min(1).max(8), z.null()]);
const schema = z.object({ dupr_singles: rating, dupr_doubles: rating, dupr_id: z.string().trim().max(20).optional() });

/**
 * Save the player's DUPR singles and doubles ratings (DUPR rates them
 * separately; tournament eligibility checks the one for each format).
 */
export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter ratings between 1.00 and 8.00." }, { status: 400 });
  const { dupr_singles, dupr_doubles, dupr_id } = parsed.data;
  if (dupr_singles == null && dupr_doubles == null) return NextResponse.json({ error: "Enter at least one rating." }, { status: 400 });
  await ensureSchema();
  await query(
    `UPDATE users SET dupr_singles = $2, dupr_doubles = $3,
       dupr = COALESCE($3, $2, dupr), dupr_id = COALESCE(NULLIF($4, ''), dupr_id) WHERE id = $1`,
    [session.id, dupr_singles, dupr_doubles, dupr_id ?? ""],
  );
  return NextResponse.json({ ok: true });
}
