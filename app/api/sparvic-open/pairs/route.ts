import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { OPEN, OPEN_CATEGORIES, categoryBlock, partnerBlock } from "@/lib/sparvic-open";
import { acceptedPairInCategory, catLabel, factsOf, member, paidCategories, pairsFor } from "@/lib/sparvic-open-server";
import { sendOpenEmail } from "@/lib/sparvic-open-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The player's pairing requests, sent and received. */
export async function GET() {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await ensureSchema();
  return NextResponse.json({ pairs: await pairsFor(session.id) });
}

const createSchema = z.object({
  category: z.string().max(20),
  partner_id: z.string().uuid("Pick a partner"),
  message: z.string().trim().max(200).optional(),
});

/** Send a doubles partner request. Every DUPR and category rule is checked here. */
export async function POST(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const rl = await checkRateLimit(`open-pair:${session.id}:${getClientIp(req)}`, 30, 15 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the request." }, { status: 400 });
  const { category, partner_id, message } = parsed.data;
  const cat = OPEN_CATEGORIES.find((c) => c.id === category);
  if (!cat || cat.type !== "doubles") return NextResponse.json({ error: "Partner requests are for doubles categories." }, { status: 400 });
  if (partner_id === session.id) return NextResponse.json({ error: "You can't partner with yourself." }, { status: 400 });
  try {
    await ensureSchema();
    const [me, partner] = await Promise.all([member(session.id), member(partner_id)]);
    if (!me || !partner) return NextResponse.json({ error: "That player could not be found." }, { status: 404 });
    const mine = categoryBlock(cat, factsOf(me));
    if (mine) return NextResponse.json({ error: `You can't enter ${cat.label}: ${mine}.` }, { status: 400 });
    const theirs = partnerBlock(cat, factsOf(me), factsOf(partner), partner.full_name.split(" ")[0]);
    if (theirs) return NextResponse.json({ error: theirs }, { status: 400 });
    if ((await paidCategories(session.id)).has(cat.id)) return NextResponse.json({ error: `You're already confirmed in ${cat.label}.` }, { status: 409 });
    if ((await paidCategories(partner.id)).has(cat.id)) return NextResponse.json({ error: `${partner.full_name} is already confirmed in ${cat.label}.` }, { status: 409 });
    if (await acceptedPairInCategory(cat.id, session.id)) return NextResponse.json({ error: `You already have an accepted partner in ${cat.label}. Register that team, or cancel it first.` }, { status: 409 });
    const existing = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM open_pairs WHERE category = $1 AND status IN ('pending','accepted')
         AND ((requester_id = $2 AND partner_id = $3) OR (requester_id = $3 AND partner_id = $2))`,
      [cat.id, session.id, partner.id],
    );
    if (existing) return NextResponse.json({ error: existing.status === "accepted" ? "You're already paired for this category." : "A request between you two is already waiting for this category." }, { status: 409 });

    const row = await queryOne<{ id: string }>(
      `INSERT INTO open_pairs (category, requester_id, partner_id, message) VALUES ($1,$2,$3,$4) RETURNING id`,
      [cat.id, session.id, partner.id, message || null],
    );
    await createNotification({
      userId: partner.id,
      actorId: session.id,
      kind: "tournament_entry",
      title: `${me.full_name} wants to partner you: ${cat.label}`,
      message: `Doubles partner request for the ${OPEN.name}. Accept or decline it in your tournament tab.`,
      linkUrl: "/dashboard/sparvic-open",
    }).catch(() => {});
    await sendOpenEmail("pair_request", partner, { other: me, category: cat.label, message });
    return NextResponse.json({ ok: true, id: row!.id });
  } catch (err) {
    console.error("[sparvic-open/pairs:create]", err);
    return NextResponse.json({ error: "Could not send the request." }, { status: 500 });
  }
}

const actSchema = z.object({ id: z.string().uuid(), action: z.enum(["accept", "decline", "cancel"]) });

/** Accept or decline a request (the partner), or withdraw it (the sender). */
export async function PATCH(req: Request) {
  const session = await getPlayerSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = actSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the request." }, { status: 400 });
  const { id, action } = parsed.data;
  try {
    await ensureSchema();
    const p = await queryOne<{ id: string; category: string; requester_id: string; partner_id: string; status: string; team_entry_ref: string | null }>(
      `SELECT id, category, requester_id, partner_id, status, team_entry_ref FROM open_pairs WHERE id = $1`,
      [id],
    );
    if (!p) return NextResponse.json({ error: "That request no longer exists." }, { status: 404 });
    const cat = OPEN_CATEGORIES.find((c) => c.id === p.category)!;
    const label = catLabel(p.category);

    if (action === "cancel") {
      if (p.requester_id !== session.id && p.partner_id !== session.id) return NextResponse.json({ error: "Not your request." }, { status: 403 });
      if (p.team_entry_ref) return NextResponse.json({ error: "This team is already registered." }, { status: 409 });
      if (!["pending", "accepted"].includes(p.status)) return NextResponse.json({ error: "This request is already closed." }, { status: 409 });
      await query(`UPDATE open_pairs SET status = 'cancelled', responded_at = now() WHERE id = $1`, [id]);
      const otherId = p.requester_id === session.id ? p.partner_id : p.requester_id;
      const me = await member(session.id);
      await createNotification({ userId: otherId, actorId: session.id, kind: "tournament_entry", title: `Pairing withdrawn: ${label}`, message: `${me?.full_name ?? "Your partner"} withdrew the pairing for ${label}.`, linkUrl: "/dashboard/sparvic-open" }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (p.partner_id !== session.id) return NextResponse.json({ error: "Only the invited partner can respond." }, { status: 403 });
    if (p.status !== "pending") return NextResponse.json({ error: "This request has already been answered." }, { status: 409 });
    const [me, requester] = await Promise.all([member(session.id), member(p.requester_id)]);
    if (!me || !requester) return NextResponse.json({ error: "Player not found." }, { status: 404 });

    if (action === "decline") {
      await query(`UPDATE open_pairs SET status = 'declined', responded_at = now() WHERE id = $1`, [id]);
      await createNotification({ userId: requester.id, actorId: me.id, kind: "tournament_entry", title: `Partner request declined: ${label}`, message: `${me.full_name} can't partner with you in ${label}. Try another eligible player.`, linkUrl: "/dashboard/sparvic-open" }).catch(() => {});
      await sendOpenEmail("pair_declined", requester, { other: me, category: label });
      return NextResponse.json({ ok: true });
    }

    // Accept: re-check eligibility (ratings may have changed) and one team per category.
    const why = categoryBlock(cat, factsOf(me)) ?? partnerBlock(cat, factsOf(requester), factsOf(me), "You");
    if (why) return NextResponse.json({ error: why }, { status: 400 });
    if (await acceptedPairInCategory(cat.id, me.id)) return NextResponse.json({ error: `You already have a partner in ${label}. Withdraw that pairing first to accept this one.` }, { status: 409 });
    if (await acceptedPairInCategory(cat.id, requester.id)) return NextResponse.json({ error: `${requester.full_name} has already paired with someone else in ${label}.` }, { status: 409 });
    if ((await paidCategories(me.id)).has(cat.id) || (await paidCategories(requester.id)).has(cat.id)) return NextResponse.json({ error: `One of you is already confirmed in ${label}.` }, { status: 409 });
    await query(`UPDATE open_pairs SET status = 'accepted', responded_at = now() WHERE id = $1`, [id]);
    await createNotification({ userId: requester.id, actorId: me.id, kind: "tournament_entry", title: `${me.full_name} accepted: ${label}`, message: `You're paired for ${label}. Either of you can now register and pay the team entry.`, linkUrl: "/dashboard/sparvic-open" }).catch(() => {});
    await sendOpenEmail("pair_accepted", requester, { other: me, category: label });
    const follows = await queryOne<{ f: boolean }>(`SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) AS f`, [me.id, requester.id]);
    return NextResponse.json({ ok: true, category: cat.id, partner: { id: requester.id, name: requester.full_name, handle: requester.handle }, following: Boolean(follows?.f) });
  } catch (err) {
    console.error("[sparvic-open/pairs:act]", err);
    return NextResponse.json({ error: "Could not update the request." }, { status: 500 });
  }
}
