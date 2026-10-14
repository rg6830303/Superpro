import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createRazorpayOrder, isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { OPEN, OPEN_CATEGORIES, totalPaise, validateEntries } from "@/lib/sparvic-open";
import { myEntries, newReference, paidCategories } from "@/lib/sparvic-open-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  entries: z
    .array(
      z.object({
        category: z.string().max(20),
        partner_name: z.string().trim().max(80).optional(),
        partner_phone: z.string().trim().max(10).optional(),
        partner_dupr: z.coerce.number().min(0).max(8).nullable().optional(),
      }),
    )
    .min(1, "Pick at least one category.")
    .max(OPEN_CATEGORIES.length),
  // Only used when the profile has no rating yet; saved to the profile.
  dupr: z.coerce.number().min(1).max(8).optional(),
  dupr_id: z.string().trim().max(20).optional(),
});

/** The signed-in player's entries. */
export async function GET() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await ensureSchema();
  return NextResponse.json({ entries: await myEntries(session.id) });
}

/**
 * Create an entry for one or more categories and open a Razorpay order for the
 * total. Members only; every rule is checked here, not just in the form.
 */
export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Create an account or sign in to register." }, { status: 401 });
  const rl = await checkRateLimit(`open-reg:${session.id}:${getClientIp(req)}`, 15, 15 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your entry." }, { status: 400 });

  try {
    await ensureSchema();
    const profile = await getUserRow(session.id);
    if (!profile) return NextResponse.json({ error: "Your profile could not be found." }, { status: 404 });

    // A first rating entered on the form becomes the profile's rating.
    let dupr = profile.dupr != null ? Number(profile.dupr) : null;
    if (dupr == null && parsed.data.dupr != null) {
      dupr = parsed.data.dupr;
      await query(`UPDATE users SET dupr = $2, dupr_id = COALESCE(NULLIF($3, ''), dupr_id) WHERE id = $1`, [
        session.id,
        dupr,
        parsed.data.dupr_id ?? "",
      ]);
    }

    const entries = parsed.data.entries.map((e) => {
      const cat = OPEN_CATEGORIES.find((c) => c.id === e.category);
      return cat?.type === "doubles"
        ? { category: e.category, partner_name: e.partner_name?.trim(), partner_phone: e.partner_phone || undefined, partner_dupr: e.partner_dupr ?? null }
        : { category: e.category };
    });
    const error = validateEntries(entries, { dupr, gender: profile.gender ?? null }, await paidCategories(session.id));
    if (error) return NextResponse.json({ error }, { status: 400 });

    if (!isRazorpayEnabled) return NextResponse.json({ error: "Online payment isn't available right now. Please call us." }, { status: 503 });
    const amount = totalPaise(entries.map((e) => e.category));
    const reference = newReference();
    const order = await createRazorpayOrder({ amountPaise: amount, receipt: reference, notes: { kind: "sparvic_open", reference } });
    await queryOne(
      `INSERT INTO open_entries (reference, user_id, player_name, player_phone, player_email, player_dupr, player_dupr_id,
         player_gender, categories, amount_paise, razorpay_order_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) RETURNING id`,
      [reference, session.id, profile.full_name, profile.phone, profile.email, dupr, profile.dupr_id ?? parsed.data.dupr_id ?? null,
       profile.gender, JSON.stringify(entries), amount, order.id],
    );
    return NextResponse.json({
      ok: true,
      reference,
      order: { id: order.id, amount: order.amount },
      key_id: razorpayKeyId,
      prefill: { name: profile.full_name, contact: profile.phone ?? undefined, email: profile.email },
      description: `${OPEN.name} · ${entries.length} categor${entries.length === 1 ? "y" : "ies"}`,
    });
  } catch (err) {
    console.error("[sparvic-open]", err);
    return NextResponse.json({ error: "Could not start the registration. Please try again." }, { status: 500 });
  }
}
