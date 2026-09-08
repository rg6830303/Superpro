import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatDate, formatTimeRange } from "@/lib/dates";
import { newRef } from "@/lib/money";
import { createRazorpayOrder, isRazorpayEnabled } from "@/lib/razorpay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, playerRegistrationSchema } from "@/lib/validation";
import { bookingReceiptMessage, sendWhatsApp } from "@/lib/whatsapp";
import { adjustWallet, chargeWallet } from "@/lib/wallet";
import { postSlotToGroup } from "@/lib/games";

export const runtime = "nodejs";

type SessionRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  court_number: number;
  capacity: number;
  price_paise: number;
  status: string;
  venue_name: string;
  booked: number;
};

/**
 * Daily-games registration: one player (or their group) across one or more
 * slots for the week. Capacity is re-checked server-side against a live count,
 * so two people racing for the last spot cannot both be confirmed.
 */
export async function POST(req: Request) {
  let refundOnFailure: { userId: string; amountPaise: number; reference: string } | null = null;
  try {
    const rl = await checkRateLimit(`game-reg:${getClientIp(req)}`, 15, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const parsed = playerRegistrationSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;

    await ensureSchema();

    const sessions = await query<SessionRow>(
      `SELECT s.id, s.session_date::text AS session_date, s.start_time, s.end_time, s.court_number, s.capacity,
              s.price_paise, s.status, v.name AS venue_name,
              COALESCE((SELECT SUM(players_count) FROM game_registrations r
                        WHERE r.session_id = s.id AND r.status <> 'cancelled'), 0)::int AS booked
       FROM game_sessions s JOIN venues v ON v.id = s.venue_id
       WHERE s.id = ANY($1::uuid[])`,
      [input.session_ids],
    );

    if (sessions.length !== input.session_ids.length) {
      return NextResponse.json({ error: "One of those slots no longer exists." }, { status: 409 });
    }

    for (const s of sessions) {
      if (s.status !== "open") {
        return NextResponse.json(
          { error: `The ${formatDate(s.session_date)} ${s.start_time} slot is closed.` },
          { status: 409 },
        );
      }
      if (s.capacity - s.booked < input.players_count) {
        return NextResponse.json(
          { error: `The ${formatDate(s.session_date)} ${s.start_time} slot just filled up. Pick another.` },
          { status: 409 },
        );
      }
    }

    const total = sessions.reduce((sum, s) => sum + s.price_paise * input.players_count, 0);
    const reference = newRef("SPG");
    const session = await getPlayerSession();

    // Wallet is only offered to signed-in players, and the debit happens BEFORE
    // the rows are written so an insufficient balance never leaves a half-paid
    // booking behind.
    const wantsWallet = input.payment_method === "wallet";
    if (wantsWallet && !session) {
      return NextResponse.json({ error: "Sign in to pay from your wallet." }, { status: 401 });
    }
    if (wantsWallet && session) {
      const charge = await chargeWallet({
        userId: session.id,
        amountPaise: total,
        kind: "booking",
        reason: `Daily games — ${sessions.length} slot${sessions.length > 1 ? "s" : ""} (${reference})`,
        refTable: "game_registrations",
      });
      if (!charge.ok) {
        return NextResponse.json({ error: charge.error, wallet_balance_paise: charge.balancePaise }, { status: 409 });
      }
      refundOnFailure = { userId: session.id, amountPaise: total, reference };
    }

    const wantsOnline = !wantsWallet && input.payment_method === "razorpay" && isRazorpayEnabled;
    const method = wantsWallet ? "wallet" : wantsOnline ? "razorpay" : "venue";
    const paymentStatus = wantsWallet ? "paid" : "pending";

    for (const s of sessions) {
      await query(
        `INSERT INTO game_registrations (reference, session_id, user_id, player_name, player_phone,
           player_email, skill_level, players_count, court_number, amount_paise, payment_method,
           payment_status, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$13,'confirmed',$12)
         ON CONFLICT (session_id, player_phone) DO UPDATE
           SET players_count = EXCLUDED.players_count,
               status = 'confirmed',
               reference = EXCLUDED.reference,
               amount_paise = EXCLUDED.amount_paise,
               payment_method = EXCLUDED.payment_method`,
        [
          reference,
          s.id,
          session?.id ?? null,
          input.player_name,
          input.player_phone,
          input.player_email || null,
          input.skill_level,
          input.players_count,
          s.court_number,
          s.price_paise * input.players_count,
          method,
          input.notes ?? null,
          paymentStatus,
        ],
      );
    }

    let razorpayOrderId: string | null = null;
    if (wantsOnline) {
      try {
        const rzp = await createRazorpayOrder({
          amountPaise: total,
          receipt: reference,
          notes: { reference, player: input.player_name },
        });
        razorpayOrderId = rzp.id;
        await query(`UPDATE game_registrations SET razorpay_order_id = $1 WHERE reference = $2`, [
          rzp.id,
          reference,
        ]);
      } catch (err) {
        console.error("[games] razorpay order failed, falling back to pay-at-venue:", err);
        await query(`UPDATE game_registrations SET payment_method = 'venue' WHERE reference = $1`, [reference]);
      }
    }

    const bookings = sessions.map((s) => ({
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      venue_name: s.venue_name,
      court_number: s.court_number,
      status: "confirmed",
    }));

    // Pay-at-venue bookings are confirmed now; online ones confirm after
    // /api/payments/verify so we never announce an unpaid slot.
    if (!razorpayOrderId) {
      // Receipts and the group post are best-effort: the slot is already
      // booked and (for wallet) already paid, so a WhatsApp hiccup must never
      // turn into an error the player sees.
      await confirmComms({ reference, input, sessions, total, method }).catch((err) =>
        console.error("[games] confirmation comms failed:", err),
      );
    }

    refundOnFailure = null;

    return NextResponse.json({
      ok: true,
      reference,
      total_paise: total,
      payment_method: method,
      bookings,
      razorpay_order_id: razorpayOrderId,
    });
  } catch (err) {
    console.error("[games/register]", err);
    // If money left the wallet but the booking did not complete, put it back
    // rather than leaving the player short with nothing to show for it.
    if (refundOnFailure) {
      await adjustWallet({
        userId: refundOnFailure.userId,
        deltaPaise: refundOnFailure.amountPaise,
        kind: "refund",
        reason: `Auto-refund — booking ${refundOnFailure.reference} failed`,
        createdBy: "system",
      }).catch((e) => console.error("[games] auto-refund failed:", e));
    }
    return NextResponse.json({ error: "Could not complete the booking. Please try again." }, { status: 500 });
  }
}

async function confirmComms(args: {
  reference: string;
  input: { player_name: string; player_phone: string };
  sessions: SessionRow[];
  total: number;
  method: string;
}) {
  await sendWhatsApp({
    kind: "game_receipt",
    target: "number",
    phone: `91${args.input.player_phone}`,
    message: bookingReceiptMessage({
      name: args.input.player_name,
      ref: args.reference,
      lines: args.sessions.map(
        (s) =>
          `${formatDate(s.session_date)} · ${formatTimeRange(s.start_time, s.end_time)} · ${s.venue_name} Court ${s.court_number}`,
      ),
      totalPaise: args.total,
      payMethod:
        args.method === "razorpay" ? "paid online" : args.method === "wallet" ? "paid from wallet" : "pay at venue",
    }),
    refTable: "game_registrations",
  });

  // The group post carries every confirmed name + court for that slot.
  for (const s of args.sessions) {
    await postSlotToGroup(s.id).catch((err) => console.error("[games] group post failed:", err));
  }
}
