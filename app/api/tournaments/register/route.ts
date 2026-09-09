import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { newRef } from "@/lib/money";
import { createRazorpayOrder, isRazorpayEnabled } from "@/lib/razorpay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, tournamentRegistrationSchema } from "@/lib/validation";
import { sendWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

/**
 * Tournament entry. Teams past `max_teams` are accepted onto the waitlist
 * rather than rejected — a cancellation is the norm, and an entry we turned
 * away is one we never hear from again.
 */
export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`tourn-reg:${getClientIp(req)}`, 10, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const parsed = tournamentRegistrationSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;

    await ensureSchema();

    const tournament = await queryOne<{
      id: string;
      title: string;
      entry_fee_paise: number;
      max_teams: number;
      registration_open: boolean;
      status: string;
      teams: number;
    }>(
      `SELECT t.id, t.title, t.entry_fee_paise, t.max_teams, t.registration_open, t.status,
              COALESCE((SELECT COUNT(*) FROM tournament_registrations r
                        WHERE r.tournament_id = t.id AND r.status <> 'withdrawn'), 0)::int AS teams
       FROM tournaments t WHERE t.id = $1 LIMIT 1`,
      [input.tournament_id],
    );

    if (!tournament) return NextResponse.json({ error: "That tournament no longer exists." }, { status: 404 });
    if (!tournament.registration_open || tournament.status !== "open") {
      return NextResponse.json({ error: "Registration for this tournament is closed." }, { status: 409 });
    }

    // Required questions on the tournament's own form must be answered.
    const formFields = await query<{ field_key: string; label: string; required: boolean }>(
      `SELECT field_key, label, required FROM tournament_form_fields WHERE tournament_id = $1`,
      [input.tournament_id],
    ).catch(() => []);
    const answers = (input.answers ?? {}) as Record<string, unknown>;
    const missing = formFields
      .filter((f) => f.required)
      .filter((f) => {
        const v = answers[f.field_key];
        return v === undefined || v === null || v === "" || v === false;
      })
      .map((f) => f.label);
    if (missing.length > 0) {
      return NextResponse.json({ error: `Please answer: ${missing.join(", ")}.` }, { status: 400 });
    }
    // Keep only answers to questions that actually exist on this form.
    const known = new Set(formFields.map((f) => f.field_key));
    const cleanAnswers: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(answers)) if (known.has(k)) cleanAnswers[k] = v;

    const duplicate = await queryOne<{ id: string }>(
      `SELECT id FROM tournament_registrations
       WHERE tournament_id = $1 AND player1_phone = $2 AND status <> 'withdrawn' LIMIT 1`,
      [input.tournament_id, input.player1_phone],
    );
    if (duplicate) {
      return NextResponse.json(
        { error: "That number is already entered in this tournament." },
        { status: 409 },
      );
    }

    const waitlisted = tournament.teams >= tournament.max_teams;
    const amount = tournament.entry_fee_paise;
    const wantsOnline = input.payment_method === "razorpay" && isRazorpayEnabled && amount > 0 && !waitlisted;
    const method = wantsOnline ? "razorpay" : "venue";
    const reference = newRef("SPT");

    const inserted = await query<{ id: string }>(
      `INSERT INTO tournament_registrations (reference, tournament_id, team_name, category,
         player1_name, player1_phone, player1_dupr, player2_name, player2_phone, player2_dupr,
         email, amount_paise, payment_method, payment_status, status, notes, answers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15,$16::jsonb)
       RETURNING id`,
      [
        reference,
        tournament.id,
        input.team_name,
        input.category ?? null,
        input.player1_name,
        input.player1_phone,
        input.player1_dupr ?? null,
        input.player2_name || null,
        input.player2_phone || null,
        input.player2_dupr ?? null,
        input.email || null,
        amount,
        method,
        waitlisted ? "waitlist" : "pending",
        input.notes ?? null,
        JSON.stringify(cleanAnswers),
      ],
    );

    let razorpayOrderId: string | null = null;
    if (wantsOnline) {
      try {
        const rzp = await createRazorpayOrder({
          amountPaise: amount,
          receipt: reference,
          notes: { reference, tournament: tournament.title, team: input.team_name },
        });
        razorpayOrderId = rzp.id;
        await query(`UPDATE tournament_registrations SET razorpay_order_id = $1 WHERE id = $2`, [
          rzp.id,
          inserted[0].id,
        ]);
      } catch (err) {
        console.error("[tournaments] razorpay order failed, falling back to pay-on-the-day:", err);
        await query(`UPDATE tournament_registrations SET payment_method = 'venue' WHERE id = $1`, [
          inserted[0].id,
        ]);
      }
    }

    if (!razorpayOrderId) {
      await sendWhatsApp({
        kind: "tournament_entry",
        target: "number",
        phone: `91${input.player1_phone}`,
        message: [
          `🏆 *${tournament.title.toUpperCase()}*`,
          ``,
          waitlisted ? `${input.team_name} is on the WAITLIST.` : `${input.team_name} is entered.`,
          `Reference: *${reference}*`,
          amount > 0 ? `Entry fee: ₹${(amount / 100).toFixed(0)} — pay at the desk on the day.` : ``,
          ``,
          `Groups and match timings are posted before the event.`,
        ]
          .filter(Boolean)
          .join("\n"),
        refTable: "tournament_registrations",
        refId: inserted[0].id,
      });
    }

    return NextResponse.json({
      ok: true,
      reference,
      team_name: input.team_name,
      status: waitlisted ? "waitlist" : "pending",
      amount_paise: amount,
      payment_method: method,
      razorpay_order_id: razorpayOrderId,
    });
  } catch (err) {
    console.error("[tournaments/register]", err);
    return NextResponse.json({ error: "Could not register that team. Please try again." }, { status: 500 });
  }
}
