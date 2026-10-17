import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { OPEN, OPEN_CATEGORIES, categoryBlock, type EntryInput, type PlayerFacts } from "@/lib/sparvic-open";
import { sendOpenEmail } from "@/lib/sparvic-open-emails";
import { sendTournamentInvoice } from "@/lib/receipts";

export type OpenEntry = {
  id: string;
  reference: string;
  user_id: string | null;
  player_name: string;
  player_phone: string | null;
  player_email: string | null;
  player_dupr: number | null;
  player_gender: string | null;
  categories: EntryInput[];
  amount_paise: number;
  discount_paise?: number;
  payment_status: "pending" | "paid" | "cancelled";
  razorpay_order_id: string | null;
  razorpay_payment_id?: string | null;
  created_at: string;
  paid_at: string | null;
};

export type Member = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  handle: string | null;
  avatar_url: string | null;
  gender: string | null;
  dupr: number | null;
  dupr_singles: number | null;
  dupr_doubles: number | null;
};

export type PairRow = {
  id: string;
  category: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message: string | null;
  team_entry_ref: string | null;
  created_at: string;
  responded_at: string | null;
  requester_id: string;
  partner_id: string;
  other_id: string;
  other_name: string;
  other_handle: string | null;
  other_avatar: string | null;
  other_gender: string | null;
  other_dupr_doubles: number | null;
  direction: "incoming" | "outgoing";
};

export const newReference = () => `SO-${randomBytes(4).toString("hex").toUpperCase()}`;
export const catLabel = (id: string) => OPEN_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export function member(id: string): Promise<Member | null> {
  return queryOne<Member>(
    `SELECT id, full_name, email, phone, handle, avatar_url, gender, dupr, dupr_singles, dupr_doubles FROM users WHERE id = $1`,
    [id],
  );
}

export const factsOf = (m: Pick<Member, "dupr" | "dupr_singles" | "dupr_doubles" | "gender">): PlayerFacts => ({
  dupr: m.dupr != null ? Number(m.dupr) : null,
  dupr_singles: m.dupr_singles != null ? Number(m.dupr_singles) : null,
  dupr_doubles: m.dupr_doubles != null ? Number(m.dupr_doubles) : null,
  gender: m.gender,
});

/** Entries this player paid for, plus team entries where they are the partner. */
export function entriesForUser(userId: string): Promise<Array<OpenEntry & { as_partner: boolean }>> {
  return query<OpenEntry & { as_partner: boolean }>(
    `SELECT *, (user_id IS DISTINCT FROM $1) AS as_partner FROM open_entries
     WHERE user_id = $1 OR (payment_status = 'paid' AND categories @> $2::jsonb)
     ORDER BY created_at DESC`,
    [userId, JSON.stringify([{ partner_user_id: userId }])],
  ).catch(() => []);
}
/** Back-compat name used by the page. */
export const myEntries = entriesForUser;

/** Categories this player already holds a paid place in, as payer or partner. */
export async function paidCategories(userId: string): Promise<Set<string>> {
  const rows = await entriesForUser(userId);
  const out = new Set<string>();
  for (const r of rows) {
    if (r.payment_status !== "paid") continue;
    for (const c of r.categories) if (!r.as_partner || c.partner_user_id === userId) out.add(c.category);
  }
  return out;
}

/**
 * Categories the player could still enter: their DUPR and gender fit the band
 * and they don't already hold a paid place in it.
 */
export async function moreEligible(userId: string): Promise<string[]> {
  const m = await member(userId);
  if (!m) return [];
  const facts = factsOf(m);
  const taken = await paidCategories(userId);
  return OPEN_CATEGORIES.filter((c) => !taken.has(c.id) && !categoryBlock(c, facts)).map((c) => c.id);
}

/** Every pairing request the player sent or received, newest first. */
export function pairsFor(userId: string): Promise<PairRow[]> {
  return query<PairRow>(
    `SELECT p.*, o.id AS other_id, o.full_name AS other_name, o.handle AS other_handle, o.avatar_url AS other_avatar,
            o.gender AS other_gender, COALESCE(o.dupr_doubles, o.dupr) AS other_dupr_doubles,
            CASE WHEN p.partner_id = $1 THEN 'incoming' ELSE 'outgoing' END AS direction
     FROM open_pairs p
     JOIN users o ON o.id = CASE WHEN p.partner_id = $1 THEN p.requester_id ELSE p.partner_id END
     WHERE p.partner_id = $1 OR p.requester_id = $1
     ORDER BY (p.status = 'pending') DESC, p.created_at DESC`,
    [userId],
  ).catch(() => []);
}

/** The accepted pairing between two players for a category, either direction. */
export function acceptedPair(category: string, a: string, b: string) {
  return queryOne<{ id: string }>(
    `SELECT id FROM open_pairs WHERE category = $1 AND status = 'accepted'
       AND ((requester_id = $2 AND partner_id = $3) OR (requester_id = $3 AND partner_id = $2))`,
    [category, a, b],
  );
}

/** A player's accepted pairing in a category with anyone (one team per category). */
export function acceptedPairInCategory(category: string, userId: string) {
  return queryOne<{ id: string; requester_id: string; partner_id: string }>(
    `SELECT id, requester_id, partner_id FROM open_pairs WHERE category = $1 AND status = 'accepted'
       AND (requester_id = $2 OR partner_id = $2) LIMIT 1`,
    [category, userId],
  );
}

/** Marks an entry paid only when the Razorpay order is the one we created for it. */
export function markOpenEntryPaid(reference: string, orderId: string, paymentId: string): Promise<OpenEntry | null> {
  return queryOne<OpenEntry>(
    `UPDATE open_entries SET payment_status = 'paid', razorpay_payment_id = $3, paid_at = COALESCE(paid_at, now())
     WHERE reference = $1 AND razorpay_order_id = $2 AND payment_status <> 'paid' RETURNING *`,
    [reference, orderId, paymentId],
  );
}

/**
 * Everything that follows a confirmed payment: the payer's confirmation,
 * each doubles partner told their team is in, the pairing stamped with the
 * entry, and any other open requests for those categories closed off.
 */
export async function afterEntryPaid(entry: OpenEntry): Promise<void> {
  const payer = entry.user_id ? await member(entry.user_id) : null;
  const names = entry.categories.map((c) => catLabel(c.category));
  if (entry.user_id) {
    await createNotification({
      userId: entry.user_id,
      kind: "tournament_entry",
      title: `You're in the ${OPEN.name}`,
      message: `Entry ${entry.reference} confirmed: ${names.join(", ")}.`,
      linkUrl: `/dashboard/sparvic-open/confirmation/${entry.reference}`,
    }).catch(() => {});
  }
  const more = entry.user_id ? (await moreEligible(entry.user_id)).map(catLabel) : [];
  if (payer) {
    await sendOpenEmail("entry_confirmed", payer, { entry, categories: names, more });
    await sendTournamentInvoice(entry, { name: payer.full_name, email: payer.email, phone: payer.phone });
  } else if (entry.player_email) {
    await sendTournamentInvoice(entry, { name: entry.player_name, email: entry.player_email, phone: entry.player_phone });
  }
  if (entry.user_id && more.length) {
    await createNotification({
      userId: entry.user_id,
      kind: "tournament_entry",
      title: `You can enter ${more.length} more categor${more.length === 1 ? "y" : "ies"}`,
      message: `Your DUPR also fits: ${more.join(", ")}. Add them from the tournament tab.`,
      linkUrl: "/dashboard/sparvic-open",
    }).catch(() => {});
  }

  for (const c of entry.categories) {
    if (!c.partner_user_id || !entry.user_id) continue;
    await query(
      `UPDATE open_pairs SET team_entry_ref = $1 WHERE category = $2 AND status = 'accepted'
         AND ((requester_id = $3 AND partner_id = $4) OR (requester_id = $4 AND partner_id = $3))`,
      [entry.reference, c.category, entry.user_id, c.partner_user_id],
    ).catch(() => {});
    const partner = await member(c.partner_user_id);
    if (partner) {
      await createNotification({
        userId: partner.id,
        actorId: entry.user_id,
        kind: "tournament_entry",
        title: `Your team is confirmed: ${catLabel(c.category)}`,
        message: `${payer?.full_name ?? "Your partner"} paid the team entry (${entry.reference}). You're in the ${OPEN.name}.`,
        linkUrl: "/dashboard/sparvic-open",
      }).catch(() => {});
      await sendOpenEmail("team_confirmed", partner, { other: payer, category: catLabel(c.category), entry });
    }
    // One team per player per category: close any other open requests.
    const closed = await query<{ id: string; requester_id: string; partner_id: string }>(
      `UPDATE open_pairs SET status = 'cancelled', responded_at = now()
       WHERE category = $1 AND status IN ('pending','accepted') AND team_entry_ref IS DISTINCT FROM $4
         AND (requester_id IN ($2,$3) OR partner_id IN ($2,$3))
       RETURNING id, requester_id, partner_id`,
      [c.category, entry.user_id, c.partner_user_id, entry.reference],
    ).catch(() => []);
    for (const p of closed) {
      const notify = [p.requester_id, p.partner_id].filter((id) => id !== entry.user_id && id !== c.partner_user_id);
      for (const id of notify) {
        await createNotification({
          userId: id,
          kind: "tournament_entry",
          title: `Pairing request closed: ${catLabel(c.category)}`,
          message: "That player is now confirmed with another partner in this category. Try another partner.",
          linkUrl: "/dashboard/sparvic-open",
        }).catch(() => {});
      }
    }
  }
}
