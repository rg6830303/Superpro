import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { OPEN_CATEGORIES, categoryBlock, partnerBlock } from "@/lib/sparvic-open";
import { sendTournamentInvoice } from "@/lib/receipts";
import { afterEntryPaid, catLabel, factsOf, member, paidCategories, type OpenEntry } from "@/lib/sparvic-open-server";
import { sendOpenEmail } from "@/lib/sparvic-open-emails";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminPair = {
  id: string; category: string; status: string; message: string | null; team_entry_ref: string | null; created_at: string; responded_at: string | null;
  requester_id: string; requester_name: string; partner_id: string; partner_name: string;
};
type AdminPlayer = { id: string; full_name: string; email: string; phone: string | null; gender: string | null; dupr: number | null; dupr_singles: number | null; dupr_doubles: number | null };

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Everything the organisers manage: entries, pairings and players' ratings. ?format=csv exports entries. */
export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    await ensureSchema();
    const [entries, pairs, players] = await Promise.all([
      query<OpenEntry>(`SELECT * FROM open_entries ORDER BY created_at DESC`),
      query<AdminPair>(
        `SELECT p.*, r.full_name AS requester_name, t.full_name AS partner_name FROM open_pairs p
         JOIN users r ON r.id = p.requester_id JOIN users t ON t.id = p.partner_id ORDER BY p.created_at DESC`,
      ),
      query<AdminPlayer>(
        `SELECT id, full_name, email, phone, gender, dupr, dupr_singles, dupr_doubles FROM users
         WHERE COALESCE(role,'player') = 'player' ORDER BY full_name`,
      ),
    ]);
    if (new URL(req.url).searchParams.get("format") === "csv") {
      const lines = [["Reference", "Status", "Player", "Phone", "Email", "DUPR", "Category", "Partner", "Partner phone", "Partner email", "Partner DUPR ID", "Partner DUPR", "Amount (Rs)", "Early-bird discount (Rs)", "Paid at", "Created"].map(csvCell).join(",")];
      for (const e of entries) {
        for (const c of e.categories) {
          lines.push([e.reference, e.payment_status, e.player_name, e.player_phone, e.player_email, e.player_dupr, catLabel(c.category), c.partner_name, c.partner_phone, c.partner_email, c.partner_dupr_id, c.partner_dupr,
            (e.amount_paise / 100).toFixed(2), ((e.discount_paise ?? 0) / 100).toFixed(2), e.paid_at, e.created_at].map(csvCell).join(","));
        }
      }
      return new NextResponse(lines.join("\n"), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="sparvic-open-entries.csv"` },
      });
    }
    return NextResponse.json({ entries, pairs, players });
  } catch (err) {
    return serverError("sparvic-open:list", err);
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("entry_mark_paid"), reference: z.string(), note: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal("entry_cancel"), reference: z.string(), note: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal("entry_remove_category"), reference: z.string(), category: z.string() }),
  z.object({ action: z.literal("entry_resend_email"), reference: z.string() }),
  z.object({ action: z.literal("pair_create"), category: z.string(), requester_id: z.string().uuid(), partner_id: z.string().uuid(), force: z.boolean().optional() }),
  z.object({ action: z.literal("pair_status"), id: z.string().uuid(), status: z.enum(["pending", "accepted", "declined", "cancelled"]), force: z.boolean().optional() }),
  z.object({ action: z.literal("rating_set"), user_id: z.string().uuid(), dupr_singles: z.number().min(1).max(8).nullable(), dupr_doubles: z.number().min(1).max(8).nullable() }),
]);

/** Manual controls for the organisers. Every change is audited. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Check the request.");
  const d = parsed.data;
  try {
    await ensureSchema();
    const entryOf = (ref: string) => queryOne<OpenEntry>(`SELECT * FROM open_entries WHERE reference = $1`, [ref]);

    switch (d.action) {
      case "entry_mark_paid": {
        const e = await entryOf(d.reference);
        if (!e) return badRequest("Entry not found.");
        if (e.payment_status === "paid") return badRequest("Already paid.");
        // Paid at the desk / by transfer: record it and run the same follow-up as an online payment.
        const done = await queryOne<OpenEntry>(
          `UPDATE open_entries SET payment_status = 'paid', razorpay_payment_id = $2, paid_at = now() WHERE reference = $1 RETURNING *`,
          [d.reference, `manual:${gate.email}${d.note ? `:${d.note}` : ""}`.slice(0, 240)],
        );
        if (done) await afterEntryPaid(done);
        await audit(gate, "sparvic_open.entry_mark_paid", "open_entries", e.id, { reference: e.reference, note: d.note });
        return NextResponse.json({ ok: true });
      }
      case "entry_cancel": {
        const e = await entryOf(d.reference);
        if (!e) return badRequest("Entry not found.");
        await query(`UPDATE open_entries SET payment_status = 'cancelled' WHERE reference = $1`, [d.reference]);
        await query(`UPDATE open_pairs SET team_entry_ref = NULL WHERE team_entry_ref = $1`, [d.reference]);
        if (e.user_id) {
          await createNotification({ userId: e.user_id, kind: "tournament_entry", title: "Tournament entry cancelled", message: `Entry ${e.reference} was cancelled by the organisers.${d.note ? ` ${d.note}` : ""}`, linkUrl: "/dashboard/sparvic-open" }).catch(() => {});
        }
        await audit(gate, "sparvic_open.entry_cancel", "open_entries", e.id, { reference: e.reference, status_was: e.payment_status, note: d.note });
        return NextResponse.json({ ok: true });
      }
      case "entry_remove_category": {
        const e = await entryOf(d.reference);
        if (!e) return badRequest("Entry not found.");
        const left = e.categories.filter((c) => c.category !== d.category);
        if (left.length === e.categories.length) return badRequest("That category isn't on this entry.");
        if (left.length === 0) return badRequest("That's the only category: cancel the entry instead.");
        await query(`UPDATE open_entries SET categories = $2::jsonb WHERE reference = $1`, [d.reference, JSON.stringify(left)]);
        await audit(gate, "sparvic_open.entry_remove_category", "open_entries", e.id, { reference: e.reference, category: d.category });
        return NextResponse.json({ ok: true, note: "Category removed. Refund any fee offline if it was paid." });
      }
      case "entry_resend_email": {
        const e = await entryOf(d.reference);
        if (!e || !e.user_id) return badRequest("Entry not found.");
        if (e.payment_status !== "paid") return badRequest("Only paid entries have a confirmation.");
        const payer = await member(e.user_id);
        await sendOpenEmail("entry_confirmed", payer, { entry: e, categories: e.categories.map((c) => catLabel(c.category)) });
        if (payer) await sendTournamentInvoice(e, { name: payer.full_name, email: payer.email, phone: payer.phone });
        await audit(gate, "sparvic_open.entry_resend_email", "open_entries", e.id, { reference: e.reference });
        return NextResponse.json({ ok: true });
      }
      case "pair_create": {
        const cat = OPEN_CATEGORIES.find((c) => c.id === d.category && c.type === "doubles");
        if (!cat) return badRequest("Pick a doubles category.");
        if (d.requester_id === d.partner_id) return badRequest("Pick two different players.");
        const [a, b] = await Promise.all([member(d.requester_id), member(d.partner_id)]);
        if (!a || !b) return badRequest("Player not found.");
        const rule = categoryBlock(cat, factsOf(a)) ?? partnerBlock(cat, factsOf(a), factsOf(b), b.full_name);
        if (rule && !d.force) return NextResponse.json({ error: `${rule} Tick "override rules" to pair them anyway.`, rule }, { status: 400 });
        if ((await paidCategories(a.id)).has(cat.id) || (await paidCategories(b.id)).has(cat.id)) return badRequest("One of them is already confirmed in this category.");
        await query(
          `UPDATE open_pairs SET status = 'cancelled', responded_at = now() WHERE category = $1 AND status IN ('pending','accepted')
             AND (requester_id IN ($2,$3) OR partner_id IN ($2,$3))`,
          [cat.id, a.id, b.id],
        );
        const row = await queryOne<{ id: string }>(
          `INSERT INTO open_pairs (category, requester_id, partner_id, status, message, responded_at) VALUES ($1,$2,$3,'accepted',$4, now()) RETURNING id`,
          [cat.id, a.id, b.id, "Paired by the organisers"],
        );
        for (const [to, other] of [[a, b], [b, a]] as const) {
          await createNotification({ userId: to.id, kind: "tournament_entry", title: `You're paired: ${cat.label}`, message: `The organisers paired you with ${other.full_name}. Either of you can register and pay the team entry.`, linkUrl: "/dashboard/sparvic-open" }).catch(() => {});
          await sendOpenEmail("pair_accepted", to, { other, category: cat.label });
        }
        await audit(gate, "sparvic_open.pair_create", "open_pairs", row!.id, { category: cat.id, a: a.id, b: b.id, override: Boolean(rule && d.force), rule });
        return NextResponse.json({ ok: true });
      }
      case "pair_status": {
        const p = await queryOne<{ id: string; category: string; requester_id: string; partner_id: string; status: string; team_entry_ref: string | null }>(
          `SELECT id, category, requester_id, partner_id, status, team_entry_ref FROM open_pairs WHERE id = $1`, [d.id]);
        if (!p) return badRequest("Pairing not found.");
        if (p.team_entry_ref && d.status !== "accepted") return badRequest("This team is registered. Cancel the entry first.");
        if (d.status === "accepted") {
          const clash = await queryOne(`SELECT 1 FROM open_pairs WHERE id <> $1 AND category = $2 AND status = 'accepted' AND (requester_id IN ($3,$4) OR partner_id IN ($3,$4))`,
            [p.id, p.category, p.requester_id, p.partner_id]);
          if (clash && !d.force) return badRequest("One of them already has an accepted partner in this category.");
        }
        await query(`UPDATE open_pairs SET status = $2, responded_at = now() WHERE id = $1`, [d.id, d.status]);
        for (const id of [p.requester_id, p.partner_id]) {
          await createNotification({ userId: id, kind: "tournament_entry", title: `Pairing updated: ${catLabel(p.category)}`, message: `The organisers set your pairing to "${d.status}".`, linkUrl: "/dashboard/sparvic-open" }).catch(() => {});
        }
        await audit(gate, "sparvic_open.pair_status", "open_pairs", p.id, { from: p.status, to: d.status });
        return NextResponse.json({ ok: true });
      }
      case "rating_set": {
        await query(`UPDATE users SET dupr_singles = $2, dupr_doubles = $3, dupr = COALESCE($3, $2, dupr) WHERE id = $1`, [d.user_id, d.dupr_singles, d.dupr_doubles]);
        await audit(gate, "sparvic_open.rating_set", "users", d.user_id, { singles: d.dupr_singles, doubles: d.dupr_doubles });
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    return serverError("sparvic-open:action", err);
  }
}
