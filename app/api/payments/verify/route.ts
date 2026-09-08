import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatDate, formatTimeRange } from "@/lib/dates";
import { postSlotToGroup } from "@/lib/games";
import { fulfilOnlineOrder } from "@/lib/orders";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { bookingReceiptMessage, orderReceiptMessage, sendWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["order", "game", "coaching", "tournament"]),
  id: z.string().uuid().optional(),
  reference: z.string().min(3).max(40).optional(),
  razorpay_order_id: z.string().min(3),
  razorpay_payment_id: z.string().min(3),
  razorpay_signature: z.string().min(3),
});

/**
 * Confirm a Razorpay payment.
 *
 * Two checks must both pass before anything is marked paid:
 *   1. HMAC signature over `order_id|payment_id` with the key secret.
 *   2. The razorpay_order_id must match the one WE created for that record —
 *      otherwise a valid signature from an unrelated ₹1 order could be replayed
 *      to mark an expensive booking paid.
 */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    const p = parsed.data;

    if (
      !verifyRazorpaySignature({
        orderId: p.razorpay_order_id,
        paymentId: p.razorpay_payment_id,
        signature: p.razorpay_signature,
      })
    ) {
      console.error("[payments] signature mismatch", { kind: p.kind, order: p.razorpay_order_id });
      return NextResponse.json({ error: "Payment signature could not be verified." }, { status: 400 });
    }

    await ensureSchema();

    switch (p.kind) {
      case "order":
        return await settleOrder(p);
      case "game":
        return await settleGame(p);
      case "coaching":
        return await settleCoaching(p);
      case "tournament":
        return await settleTournament(p);
    }
  } catch (err) {
    console.error("[payments/verify]", err);
    return NextResponse.json({ error: "Could not verify the payment." }, { status: 500 });
  }
}

type Payload = z.infer<typeof schema>;

async function settleOrder(p: Payload) {
  if (!p.id) return NextResponse.json({ error: "Missing order id." }, { status: 400 });

  const order = await queryOne<{
    id: string;
    order_no: string;
    customer_name: string;
    customer_phone: string;
    items: Array<{ name: string; qty: number }>;
    total_paise: number;
    delivery_mode: string;
    razorpay_order_id: string | null;
    payment_status: string;
  }>(`SELECT * FROM orders WHERE id = $1 LIMIT 1`, [p.id]);

  if (!order || order.razorpay_order_id !== p.razorpay_order_id) {
    return NextResponse.json({ error: "That payment does not match this order." }, { status: 409 });
  }
  if (order.payment_status === "paid") return NextResponse.json({ ok: true, already: true });

  await query(
    `UPDATE orders SET payment_status = 'paid', razorpay_payment_id = $1, razorpay_signature = $2,
       updated_at = now() WHERE id = $3`,
    [p.razorpay_payment_id, p.razorpay_signature, order.id],
  );
  await fulfilOnlineOrder(order.id);

  await sendWhatsApp({
    kind: "order_receipt",
    target: "number",
    phone: `91${order.customer_phone}`,
    message: orderReceiptMessage({
      name: order.customer_name,
      orderNo: order.order_no,
      items: order.items ?? [],
      totalPaise: order.total_paise,
      mode: order.delivery_mode,
    }),
    refTable: "orders",
    refId: order.id,
  });

  return NextResponse.json({ ok: true, order_no: order.order_no });
}

async function settleGame(p: Payload) {
  if (!p.reference) return NextResponse.json({ error: "Missing booking reference." }, { status: 400 });

  const rows = await query<{
    id: string;
    session_id: string;
    player_name: string;
    player_phone: string;
    amount_paise: number;
    razorpay_order_id: string | null;
    session_date: string;
    start_time: string;
    end_time: string;
    court_number: number;
    venue_name: string;
  }>(
    `SELECT r.id, r.session_id, r.player_name, r.player_phone, r.amount_paise, r.razorpay_order_id,
            s.session_date::text AS session_date, s.start_time, s.end_time, s.court_number, v.name AS venue_name
     FROM game_registrations r
     JOIN game_sessions s ON s.id = r.session_id
     JOIN venues v ON v.id = s.venue_id
     WHERE r.reference = $1`,
    [p.reference],
  );

  if (rows.length === 0 || rows[0].razorpay_order_id !== p.razorpay_order_id) {
    return NextResponse.json({ error: "That payment does not match this booking." }, { status: 409 });
  }

  await query(
    `UPDATE game_registrations SET payment_status = 'paid', razorpay_payment_id = $1, status = 'confirmed'
     WHERE reference = $2`,
    [p.razorpay_payment_id, p.reference],
  );

  const total = rows.reduce((sum, r) => sum + r.amount_paise, 0);
  await sendWhatsApp({
    kind: "game_receipt",
    target: "number",
    phone: `91${rows[0].player_phone}`,
    message: bookingReceiptMessage({
      name: rows[0].player_name,
      ref: p.reference,
      lines: rows.map(
        (r) =>
          `${formatDate(r.session_date)} · ${formatTimeRange(r.start_time, r.end_time)} · ${r.venue_name} Court ${r.court_number}`,
      ),
      totalPaise: total,
      payMethod: "paid online",
    }),
    refTable: "game_registrations",
    refId: rows[0].id,
  });

  for (const sessionId of [...new Set(rows.map((r) => r.session_id))]) {
    await postSlotToGroup(sessionId).catch((err) => console.error("[payments] group post failed:", err));
  }

  return NextResponse.json({
    ok: true,
    reference: p.reference,
    bookings: rows.map((r) => ({
      session_date: r.session_date,
      start_time: r.start_time,
      end_time: r.end_time,
      venue_name: r.venue_name,
      court_number: r.court_number,
      status: "confirmed",
    })),
  });
}

async function settleCoaching(p: Payload) {
  if (!p.reference) return NextResponse.json({ error: "Missing booking reference." }, { status: 400 });

  const booking = await queryOne<{ id: string; razorpay_order_id: string | null; player_phone: string; coach_name: string }>(
    `SELECT b.id, b.razorpay_order_id, b.player_phone, c.name AS coach_name
     FROM coaching_bookings b JOIN coaches c ON c.id = b.coach_id
     WHERE b.booking_no = $1 LIMIT 1`,
    [p.reference],
  );
  if (!booking || booking.razorpay_order_id !== p.razorpay_order_id) {
    return NextResponse.json({ error: "That payment does not match this booking." }, { status: 409 });
  }

  await query(
    `UPDATE coaching_bookings SET payment_status = 'paid', razorpay_payment_id = $1,
       status = 'confirmed', updated_at = now() WHERE id = $2`,
    [p.razorpay_payment_id, booking.id],
  );

  await sendWhatsApp({
    kind: "coaching_paid",
    target: "number",
    phone: `91${booking.player_phone}`,
    message: `🎾 SuperPro — payment received for your coaching block with ${booking.coach_name}. Ref ${p.reference}. Your coach will confirm the exact timing on WhatsApp.`,
    refTable: "coaching_bookings",
    refId: booking.id,
  });

  return NextResponse.json({ ok: true, booking_no: p.reference });
}

async function settleTournament(p: Payload) {
  if (!p.reference) return NextResponse.json({ error: "Missing entry reference." }, { status: 400 });

  const reg = await queryOne<{
    id: string;
    razorpay_order_id: string | null;
    team_name: string;
    player1_phone: string;
    title: string;
  }>(
    `SELECT r.id, r.razorpay_order_id, r.team_name, r.player1_phone, t.title
     FROM tournament_registrations r JOIN tournaments t ON t.id = r.tournament_id
     WHERE r.reference = $1 LIMIT 1`,
    [p.reference],
  );
  if (!reg || reg.razorpay_order_id !== p.razorpay_order_id) {
    return NextResponse.json({ error: "That payment does not match this entry." }, { status: 409 });
  }

  await query(
    `UPDATE tournament_registrations SET payment_status = 'paid', razorpay_payment_id = $1,
       status = 'confirmed' WHERE id = $2`,
    [p.razorpay_payment_id, reg.id],
  );

  await sendWhatsApp({
    kind: "tournament_paid",
    target: "number",
    phone: `91${reg.player1_phone}`,
    message: `🏆 ${reg.title} — ${reg.team_name} is confirmed. Ref ${p.reference}. Groups and timings are posted before the event.`,
    refTable: "tournament_registrations",
    refId: reg.id,
  });

  return NextResponse.json({ ok: true, reference: p.reference });
}
