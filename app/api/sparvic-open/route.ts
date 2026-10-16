import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createRazorpayOrder, isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { LAUNCH_AT } from "@/lib/site";
import { OPEN, OPEN_CATEGORIES, PAIRING_ENABLED, earlyBirdPaise, partnerBlock, totalPaise, validateEntries, type EntryInput } from "@/lib/sparvic-open";
import { acceptedPair, afterEntryPaid, entriesForUser, factsOf, member, newReference, paidCategories, type OpenEntry } from "@/lib/sparvic-open-server";
import { debitForTournament, refundTournament } from "@/lib/sparvic-open-wallet";

const inr = (x: number) => `₹${(Number(x) / 100).toLocaleString("en-IN")}`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rating = z.coerce.number().min(1).max(8).nullable().optional();
const schema = z.object({
  entries: z
    .array(
      z.object({
        category: z.string().max(20),
        partner_user_id: z.string().uuid().optional(),
        // A partner typed in by hand (used while member pairing is switched off).
        partner_name: z.string().trim().max(80).optional(),
        partner_dupr_id: z.string().trim().max(30).optional(),
        partner_dupr: z.coerce.number().min(1).max(8).nullable().optional(),
        partner_phone: z.string().trim().max(10).optional(),
        partner_email: z.string().trim().toLowerCase().max(120).optional(),
      }),
    )
    .min(1, "Pick at least one category.")
    .max(OPEN_CATEGORIES.length),
  // DUPR keeps singles and doubles ratings apart; both are saved to the profile.
  dupr_singles: rating,
  dupr_doubles: rating,
  dupr_id: z.string().trim().max(20).optional(),
  pay_method: z.enum(["online", "wallet"]).default("online"),
});

/** The signed-in player's entries (paid for, or registered as a partner). */
export async function GET() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await ensureSchema();
  return NextResponse.json({ entries: await entriesForUser(session.id) });
}

/**
 * Create an entry for one or more categories and open a Razorpay order for the
 * total. Singles are checked against the singles rating, doubles against the
 * doubles rating, and every doubles partner must be an accepted Sparvic
 * pairing whose own doubles rating fits the band.
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

    // Ratings typed on the form become the profile's ratings.
    const { dupr_singles, dupr_doubles, dupr_id } = parsed.data;
    if (dupr_singles !== undefined || dupr_doubles !== undefined) {
      await query(
        `UPDATE users SET dupr_singles = COALESCE($2, dupr_singles), dupr_doubles = COALESCE($3, dupr_doubles),
           dupr = COALESCE(dupr, $3, $2), dupr_id = COALESCE(NULLIF($4, ''), dupr_id) WHERE id = $1`,
        [session.id, dupr_singles ?? null, dupr_doubles ?? null, dupr_id ?? ""],
      );
    }
    const me = await member(session.id);
    if (!me) return NextResponse.json({ error: "Your profile could not be found." }, { status: 404 });
    const facts = factsOf(me);

    const entries: EntryInput[] = [];
    for (const e of parsed.data.entries) {
      const cat = OPEN_CATEGORIES.find((c) => c.id === e.category);
      if (!cat) return NextResponse.json({ error: "One of those categories doesn't exist." }, { status: 400 });
      if (cat.type === "singles") { entries.push({ category: cat.id }); continue; }
      if (!e.partner_user_id) {
        if (PAIRING_ENABLED) return NextResponse.json({ error: `${cat.label}: pick a Sparvic partner first.` }, { status: 400 });
        entries.push({
          category: cat.id,
          partner_name: e.partner_name,
          partner_dupr_id: e.partner_dupr_id,
          partner_dupr: e.partner_dupr ?? null,
          partner_phone: (e.partner_phone ?? "").replace(/\D/g, ""),
          partner_email: e.partner_email,
        });
        continue;
      }
      if (!PAIRING_ENABLED) return NextResponse.json({ error: `${cat.label}: enter your partner's details.` }, { status: 400 });
      const pair = await acceptedPair(cat.id, session.id, e.partner_user_id);
      if (!pair) return NextResponse.json({ error: `${cat.label}: your partner hasn't accepted the request yet.` }, { status: 400 });
      const partner = await member(e.partner_user_id);
      if (!partner) return NextResponse.json({ error: `${cat.label}: partner not found.` }, { status: 400 });
      const why = partnerBlock(cat, facts, factsOf(partner), partner.full_name.split(" ")[0]);
      if (why) return NextResponse.json({ error: `${cat.label}: ${why}` }, { status: 400 });
      if ((await paidCategories(partner.id)).has(cat.id)) return NextResponse.json({ error: `${cat.label}: ${partner.full_name} is already confirmed in this category.` }, { status: 409 });
      entries.push({
        category: cat.id,
        partner_user_id: partner.id,
        partner_name: partner.full_name,
        partner_phone: partner.phone ?? undefined,
        partner_dupr: factsOf(partner).dupr_doubles ?? factsOf(partner).dupr,
        pair_id: pair.id,
      });
    }
    const error = validateEntries(entries, facts, await paidCategories(session.id));
    if (error) return NextResponse.json({ error }, { status: 400 });

    // Early bird: accounts created before the coming-soon countdown ended.
    const early = Boolean(profile.created_at) && new Date(profile.created_at).getTime() < LAUNCH_AT;
    const gross = totalPaise(entries.map((e) => e.category));
    const discount = earlyBirdPaise(gross, early);
    const amount = gross - discount;
    const reference = newReference();

    if (parsed.data.pay_method === "wallet") {
      // Sparvic Wallet: debit first (all or nothing), then save the paid entry.
      const debit = await debitForTournament(session.id, amount, reference);
      if (!debit.ok) {
        return NextResponse.json(
          { error: `Your wallet has ${inr(debit.balancePaise)}, the entry is ${inr(amount)}. Top up your wallet or pay online.`, code: "wallet_insufficient", balance_paise: debit.balancePaise },
          { status: 402 },
        );
      }
      const paidEntry = await queryOne<OpenEntry>(
        `INSERT INTO open_entries (reference, user_id, player_name, player_phone, player_email, player_dupr, player_dupr_id,
           player_gender, categories, amount_paise, discount_paise, payment_status, razorpay_payment_id, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,'paid','wallet', now()) RETURNING *`,
        [reference, session.id, me.full_name, me.phone, me.email, facts.dupr_doubles ?? facts.dupr_singles ?? facts.dupr,
         profile.dupr_id ?? dupr_id ?? null, me.gender, JSON.stringify(entries), amount, discount],
      ).catch(async (err) => {
        console.error("[sparvic-open] wallet entry insert failed, refunding:", err);
        await refundTournament(session.id, amount, reference);
        return null;
      });
      if (!paidEntry) return NextResponse.json({ error: "Could not save your entry. Your wallet was not charged." }, { status: 500 });
      await afterEntryPaid(paidEntry);
      return NextResponse.json({ ok: true, reference, paid_via: "wallet", balance_paise: debit.balancePaise });
    }

    if (!isRazorpayEnabled) return NextResponse.json({ error: "Online payment isn't available right now. Pay from your Sparvic Wallet or call us." }, { status: 503 });
    const order = await createRazorpayOrder({ amountPaise: amount, receipt: reference, notes: { kind: "sparvic_open", reference } });
    await queryOne(
      `INSERT INTO open_entries (reference, user_id, player_name, player_phone, player_email, player_dupr, player_dupr_id,
         player_gender, categories, amount_paise, discount_paise, razorpay_order_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12) RETURNING id`,
      [reference, session.id, me.full_name, me.phone, me.email, facts.dupr_doubles ?? facts.dupr_singles ?? facts.dupr,
       profile.dupr_id ?? dupr_id ?? null, me.gender, JSON.stringify(entries), amount, discount, order.id],
    );
    return NextResponse.json({
      ok: true,
      reference,
      order: { id: order.id, amount: order.amount },
      key_id: razorpayKeyId,
      discount_paise: discount,
      prefill: { name: me.full_name, contact: me.phone ?? undefined, email: me.email },
      description: `${OPEN.name} · ${entries.length} categor${entries.length === 1 ? "y" : "ies"}${discount ? ` · Early bird ${OPEN.earlyBirdPct}% off applied` : ""}`,
    });
  } catch (err) {
    console.error("[sparvic-open]", err);
    return NextResponse.json({ error: "Could not start the registration. Please try again." }, { status: 500 });
  }
}
