import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatDate } from "@/lib/dates";
import { newRef } from "@/lib/money";
import { createRazorpayOrder, isRazorpayEnabled } from "@/lib/razorpay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { coachingBookingSchema, formatZodError } from "@/lib/validation";
import { coachingRequestMessage, sendWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

const MULTIPLIER: Record<string, number> = { single: 1, pair: 1.5, group: 2 };

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`coaching:${getClientIp(req)}`, 12, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const parsed = coachingBookingSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;

    await ensureSchema();

    const coach = await queryOne<{ id: string; name: string; rate_paise: number; whatsapp: string | null }>(
      `SELECT id, name, rate_paise, whatsapp FROM coaches WHERE id = $1 AND active LIMIT 1`,
      [input.coach_id],
    );
    if (!coach) {
      return NextResponse.json({ error: "That coach is no longer taking bookings." }, { status: 409 });
    }

    // Rate comes from the coaches table, never from the client.
    const amount = Math.round(coach.rate_paise * (MULTIPLIER[input.session_type] ?? 1) * input.sessions_count);
    const wantsOnline = input.payment_method === "razorpay" && isRazorpayEnabled;
    const method = wantsOnline ? "razorpay" : "venue";
    const bookingNo = newRef("SPC");
    const session = await getPlayerSession();

    const inserted = await query<{ id: string }>(
      `INSERT INTO coaching_bookings (booking_no, coach_id, user_id, player_name, player_phone, player_email,
         skill_level, session_type, sessions_count, preferred_date, preferred_time, amount_paise,
         payment_method, payment_status, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending','requested',$14)
       RETURNING id`,
      [
        bookingNo,
        coach.id,
        session?.id ?? null,
        input.player_name,
        input.player_phone,
        input.player_email || null,
        input.skill_level,
        input.session_type,
        input.sessions_count,
        input.preferred_date,
        input.preferred_time,
        amount,
        method,
        input.notes ?? null,
      ],
    );

    let razorpayOrderId: string | null = null;
    if (wantsOnline) {
      try {
        const rzp = await createRazorpayOrder({
          amountPaise: amount,
          receipt: bookingNo,
          notes: { booking_no: bookingNo, coach: coach.name },
        });
        razorpayOrderId = rzp.id;
        await query(`UPDATE coaching_bookings SET razorpay_order_id = $1 WHERE id = $2`, [rzp.id, inserted[0].id]);
      } catch (err) {
        console.error("[coaching] razorpay order failed, falling back to pay-at-court:", err);
        await query(`UPDATE coaching_bookings SET payment_method = 'venue' WHERE id = $1`, [inserted[0].id]);
      }
    }

    const when = `${formatDate(input.preferred_date)} at ${input.preferred_time}`;

    if (!razorpayOrderId) {
      // Confirm to the player, and ping the coach directly when we have their number.
      await sendWhatsApp({
        kind: "coaching_request",
        target: "number",
        phone: `91${input.player_phone}`,
        message: coachingRequestMessage({
          name: input.player_name,
          coach: coach.name,
          when,
          sessions: input.sessions_count,
          ref: bookingNo,
        }),
        refTable: "coaching_bookings",
        refId: inserted[0].id,
      });

      if (coach.whatsapp) {
        await sendWhatsApp({
          kind: "coaching_coach_alert",
          target: "number",
          phone: coach.whatsapp,
          message: `New SuperPro booking — ${input.player_name} (${input.skill_level}), ${input.sessions_count} × ${input.session_type}, ${when}. Ref ${bookingNo}. Player: +91${input.player_phone}`,
          refTable: "coaching_bookings",
          refId: inserted[0].id,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      booking_no: bookingNo,
      coach_name: coach.name,
      coach_whatsapp: coach.whatsapp,
      amount_paise: amount,
      payment_method: method,
      preferred_date: input.preferred_date,
      preferred_time: input.preferred_time,
      sessions_count: input.sessions_count,
      razorpay_order_id: razorpayOrderId,
    });
  } catch (err) {
    console.error("[coaching/book]", err);
    return NextResponse.json({ error: "Could not book that session. Please try again." }, { status: 500 });
  }
}
