import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatDate, formatTimeRange } from "@/lib/dates";
import { newRef, perPlayerPaise } from "@/lib/money";
import { createRazorpayOrder, isRazorpayEnabled } from "@/lib/razorpay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, playerRegistrationSchema } from "@/lib/validation";
import { bookingReceiptMessage, sendWhatsApp } from "@/lib/whatsapp";
import { adjustWallet, chargeWallet, duesPaise, getWalletBalance, isBlocked } from "@/lib/wallet";
import { postSlotToGroup } from "@/lib/games";
import { needsApproval, LEVEL_LABEL } from "@/lib/levels";
import { notifyFollowers } from "@/lib/notifications";
import { decideSeat, occupancyOf, slotGender, waitlistReason } from "@/lib/slot-rules";

export const runtime = "nodejs";

type SessionRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  court_number: number;
  capacity: number;
  level: string;
  price_paise: number;
  pricing_mode: string;
  court_fee_paise: number;
  status: string;
  mixed_doubles: boolean;
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

    // Booking is account-only: the roster, the level gate and the wallet all
    // key off a real player, so there is no guest path behind the UI either.
    const session = await getPlayerSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in to book a slot." }, { status: 401 });
    }

    const parsed = playerRegistrationSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;

    await ensureSchema();

    // Postpaid has a floor. Past it the account is settled before another slot
    // is taken — otherwise the debt compounds one booking at a time, and the
    // player finds out how much they owe only when someone finally chases them.
    const balanceNow = await getWalletBalance(session.id);
    if (isBlocked(balanceNow)) {
      return NextResponse.json(
        {
          error: `Your wallet is at its postpaid limit. Clear ₹${Math.round(duesPaise(balanceNow) / 100).toLocaleString("en-IN")} to book again.`,
          wallet_balance_paise: balanceNow,
          dues_paise: duesPaise(balanceNow),
          blocked: true,
        },
        { status: 402 },
      );
    }

    const sessions = await query<SessionRow>(
      `SELECT s.id, s.session_date::text AS session_date, s.start_time, s.end_time, s.court_number, s.capacity, s.level,
              s.price_paise, s.pricing_mode, s.court_fee_paise, s.status, s.mixed_doubles, v.name AS venue_name,
              COALESCE((SELECT SUM(players_count) FROM game_registrations r
                        WHERE r.session_id = s.id
                          AND r.status IN ('confirmed','waitlist','pending_approval')), 0)::int AS booked
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
    }

    // Already holding a seat or a waitlist place on one of these slots?
    const already = await query<{ session_id: string }>(
      `SELECT session_id FROM game_registrations
       WHERE user_id = $1 AND session_id = ANY($2::uuid[]) AND status IN ('confirmed','pending_approval','waitlist')`,
      [session.id, input.session_ids],
    );
    if (already.length > 0) {
      const s = sessions.find((x) => x.id === already[0].session_id)!;
      return NextResponse.json(
        { error: `You're already booked (or waitlisted) for ${formatDate(s.session_date)} ${s.start_time} at ${s.venue_name}.` },
        { status: 409 },
      );
    }

    // Seat, approval or waitlist — decided per slot against live occupancy,
    // court capacity (max 5) and the mixed-doubles gender quota.
    const profile = await query<{ gender: string | null }>(`SELECT gender FROM users WHERE id = $1`, [session.id]);
    const gender = slotGender(profile[0]?.gender);
    const occ = await occupancyOf(sessions.map((s) => s.id));
    const decision = new Map<string, "confirmed" | "pending_approval" | "waitlist">();
    const waitlisted: Array<{ date: string; time: string; venue: string; reason: string }> = [];
    for (const s of sessions) {
      const o = occ.get(s.id)!;
      const d = decideSeat(s, o, { gender, skill: input.skill_level, players: input.players_count });
      if ("error" in d) {
        return NextResponse.json({ error: `${formatDate(s.session_date)} ${s.start_time}: ${d.error}` }, { status: 409 });
      }
      decision.set(s.id, d.status);
      if (d.status === "waitlist") {
        waitlisted.push({ date: s.session_date, time: s.start_time, venue: s.venue_name, reason: waitlistReason(s, o, gender) });
      }
    }
    const seated = sessions.filter((s) => decision.get(s.id) !== "waitlist");

    // Price is resolved server-side from the slot's own pricing mode; the client
    // never gets to say what a slot costs. Waitlisted slots are not charged.
    const priceOf = (s: SessionRow) => perPlayerPaise(s);
    const total = seated.reduce((sum, s) => sum + priceOf(s) * input.players_count, 0);
    const reference = newRef("SPG");

    // A waitlist place costs nothing now, but the seat is paid from the wallet
    // the moment it's offered — so the amount has to be there already (on top of
    // anything this booking takes from the wallet right now).
    const waitlistPaise = sessions
      .filter((s) => decision.get(s.id) === "waitlist")
      .reduce((sum, s) => sum + priceOf(s) * input.players_count, 0);
    if (waitlistPaise > 0) {
      const takenNow = input.payment_method === "wallet" ? total : 0;
      if (balanceNow - takenNow < waitlistPaise) {
        const need = waitlistPaise + takenNow - Math.max(0, balanceNow);
        return NextResponse.json(
          {
            error: `Joining the waitlist needs ₹${(waitlistPaise / 100).toLocaleString("en-IN")} available in your Sparvic wallet — it's only taken if you get the spot. Top up ₹${(need / 100).toLocaleString("en-IN")} and try again.`,
            code: "waitlist_wallet",
            wallet_balance_paise: balanceNow,
            needed_paise: need,
          },
          { status: 402 },
        );
      }
    }

    // Wallet is only offered to signed-in players, and the debit happens BEFORE
    // the rows are written so an insufficient balance never leaves a half-paid
    // booking behind.
    const wantsWallet = input.payment_method === "wallet" && total > 0;
    if (wantsWallet) {
      const charge = await chargeWallet({
        userId: session.id,
        amountPaise: total,
        kind: "booking",
        reason: `Daily games — ${seated.length} slot${seated.length > 1 ? "s" : ""} (${reference})`,
        refTable: "game_registrations",
      });
      if (!charge.ok) {
        return NextResponse.json({ error: charge.error, wallet_balance_paise: charge.balancePaise }, { status: 409 });
      }
      refundOnFailure = { userId: session.id, amountPaise: total, reference };
    }

    const gated = sessions.filter((s) => decision.get(s.id) === "pending_approval");

    const wantsOnline = !wantsWallet && total >= 100 && input.payment_method === "razorpay" && isRazorpayEnabled;
    const method = wantsWallet ? "wallet" : wantsOnline ? "razorpay" : "venue";
    const paymentStatus = wantsWallet ? "paid" : "pending";

    for (const s of sessions) {
      await query(
        `INSERT INTO game_registrations (reference, session_id, user_id, player_name, player_phone,
           player_email, skill_level, players_count, court_number, amount_paise, payment_method,
           payment_status, status, notes, player_gender)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$13,$14,$12,$15)
         ON CONFLICT (session_id, user_id) WHERE user_id IS NOT NULL DO UPDATE
           SET players_count = EXCLUDED.players_count,
               status = EXCLUDED.status,
               reference = EXCLUDED.reference,
               amount_paise = EXCLUDED.amount_paise,
               payment_method = EXCLUDED.payment_method,
               payment_status = EXCLUDED.payment_status,
               player_gender = EXCLUDED.player_gender,
               created_at = now()`,
        [
          reference,
          s.id,
          session.id,
          input.player_name,
          input.player_phone,
          input.player_email || null,
          input.skill_level,
          input.players_count,
          s.court_number,
          priceOf(s) * input.players_count,
          decision.get(s.id) === "waitlist" ? "wallet" : method,
          input.notes ?? null,
          decision.get(s.id) === "waitlist" ? "pending" : paymentStatus,
          decision.get(s.id),
          gender,
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
        await query(`UPDATE game_registrations SET razorpay_order_id = $1 WHERE reference = $2 AND status <> 'waitlist'`, [
          rzp.id,
          reference,
        ]);
      } catch (err) {
        console.error("[games] razorpay order failed, falling back to pay-at-venue:", err);
        await query(`UPDATE game_registrations SET payment_method = 'venue' WHERE reference = $1 AND status <> 'waitlist'`, [reference]);
      }
    }

    const bookings = sessions.map((s) => ({
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      venue_name: s.venue_name,
      court_number: s.court_number,
      level: s.level,
      status: decision.get(s.id),
    }));

    const confirmedSessions = sessions.filter((s) => decision.get(s.id) === "confirmed");

    // Pay-at-venue bookings are confirmed now; online ones confirm after
    // /api/payments/verify so we never announce an unpaid slot.
    if (!razorpayOrderId && confirmedSessions.length > 0) {
      // Receipts and the group post are best-effort: the slot is already
      // booked and (for wallet) already paid, so a WhatsApp hiccup must never
      // turn into an error the player sees.
      await confirmComms({ reference, input, sessions: confirmedSessions, total, method }).catch((err) =>
        console.error("[games] confirmation comms failed:", err),
      );

      // Notify followers and following in the community feed
      if (confirmedSessions.length > 0) {
        const firstSession = confirmedSessions[0];
        await notifyFollowers({
          actorId: session.id,
          kind: "game_booking",
          title: `${session.name || input.player_name} booked a Game Slot!`,
          message: `${session.name || input.player_name} is playing at ${firstSession.venue_name} on ${formatDate(firstSession.session_date)} (${firstSession.start_time})! Join them on the court.`,
          linkUrl: "/games",
        }).catch((err) => console.error("[notifications] game notify failed:", err));
      }
    }

    refundOnFailure = null;

    return NextResponse.json({
      ok: true,
      reference,
      total_paise: total,
      payment_method: method,
      bookings,
      pending_approval: gated.map((s) => ({
        date: s.session_date,
        time: s.start_time,
        level: LEVEL_LABEL[s.level] ?? s.level,
      })),
      razorpay_order_id: razorpayOrderId,
      waitlisted,
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
