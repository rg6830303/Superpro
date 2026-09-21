import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { newRef, shippingFor } from "@/lib/money";
import { priceBasket } from "@/lib/fees";
import { checkSlots, insertRegistrations, loadSessions, slotPricePaise } from "@/lib/booking";
import { quote, redeem, releaseRedemption } from "@/lib/discounts";
import { createRazorpayOrder, isRazorpayEnabled } from "@/lib/razorpay";
import { adjustWallet, chargeWallet, duesPaise, getWalletBalance, isBlocked } from "@/lib/wallet";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { phoneSchema } from "@/lib/validation";
import type { CartLine } from "@/lib/types";

export const runtime = "nodejs";

/**
 * One checkout for the whole basket.
 *
 * Gear and court time are bought together, paid for once, and come back as one
 * reference. Everything that decides money is recomputed here from the database
 * - line prices, slot prices, the discount, the fee - because the basket that
 * arrives is a claim about what the player selected, not about what it costs.
 */

const schema = z.object({
  customer_name: z.string().trim().min(2, "Enter your name").max(80),
  customer_phone: phoneSchema,
  customer_email: z.string().trim().email().optional().or(z.literal("")),
  delivery_mode: z.enum(["pickup", "delivery"]).default("pickup"),
  address: z.record(z.string(), z.unknown()).optional().nullable(),
  payment_method: z.enum(["razorpay", "cod", "venue", "wallet"]).default("razorpay"),
  discount_code: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        product_id: z.string().min(1),
        kind: z.enum(["product", "slot"]).default("product"),
        qty: z.number().int().min(1).max(20).default(1),
        session_id: z.string().optional(),
      }),
    )
    .min(1, "Your cart is empty")
    .max(40),
});

export async function POST(req: Request) {
  let refundOnFailure: { userId: string; amountPaise: number; reference: string } | null = null;
  let releaseOnFailure: { codeId: string; reference: string } | null = null;

  try {
    const rl = await checkRateLimit(`checkout:${getClientIp(req)}`, 20, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });
    }
    const input = parsed.data;

    // Court time is account-only: rosters, level bands and the wallet all key
    // off a real player. Gear alone can still be bought signed out.
    const session = await getPlayerSession();
    const slotLines = input.lines.filter((l) => l.kind === "slot");
    if (slotLines.length > 0 && !session) {
      return NextResponse.json({ error: "Sign in to book a court slot." }, { status: 401 });
    }

    await ensureSchema();

    // Goods, re-priced from the catalogue.
    const productLines = input.lines.filter((l) => l.kind !== "slot");
    const items: Array<{ product_id: string; name: string; qty: number; price_paise: number }> = [];
    for (const line of productLines) {
      const p = await queryOne<{ id: string; name: string; price_paise: number; stock: number }>(
        `SELECT id, name, price_paise, stock FROM products WHERE id = $1 AND active LIMIT 1`,
        [line.product_id],
      );
      if (!p) return NextResponse.json({ error: "One of those products is no longer available." }, { status: 409 });
      if (Number(p.stock) < line.qty) {
        return NextResponse.json({ error: `Only ${p.stock} x ${p.name} left in stock.` }, { status: 409 });
      }
      items.push({ product_id: p.id, name: p.name, qty: line.qty, price_paise: Number(p.price_paise) });
    }

    // Court time, re-priced and re-checked for room.
    const wanted = [...new Set(slotLines.map((l) => l.session_id).filter((v): v is string => Boolean(v)))];
    const sessions = await loadSessions(wanted);
    const slotProblem = checkSlots(sessions, wanted);
    if (wanted.length > 0 && slotProblem) {
      return NextResponse.json({ error: slotProblem }, { status: 409 });
    }

    if (session && sessions.length > 0) {
      // Postpaid has a floor; past it the account settles before taking more court.
      const balance = await getWalletBalance(session.id);
      if (isBlocked(balance)) {
        const owed = Math.round(duesPaise(balance) / 100).toLocaleString("en-IN");
        return NextResponse.json(
          { error: `Your wallet is at its postpaid limit. Clear Rs ${owed} to book again.`, blocked: true },
          { status: 402 },
        );
      }
    }

    const priced: CartLine[] = [
      ...items.map((i) => ({
        product_id: i.product_id, slug: "", name: i.name, price_paise: i.price_paise,
        qty: i.qty, image_url: null, kind: "product" as const,
      })),
      ...sessions.map((s) => ({
        product_id: s.id, slug: "", name: `${s.venue_name} - ${s.start_time}`,
        price_paise: slotPricePaise(s), qty: 1, image_url: null, kind: "slot" as const,
      })),
    ];

    const goods = items.reduce((sum, i) => sum + i.price_paise * i.qty, 0);
    const courtTime = sessions.reduce((sum, s) => sum + slotPricePaise(s), 0);
    const shipping = items.length > 0 ? shippingFor(goods, input.delivery_mode) : 0;
    const reference = newRef("SP");

    // The discount is priced from the code row and claimed before anything is
    // charged, so a code that runs out mid-checkout charges full price rather
    // than handing out a discount nobody can account for.
    let discountPaise = 0;
    let discountCode: string | null = null;
    if (input.discount_code) {
      const basketScopes: import("@/lib/discounts").DiscountScope[] = [];
      if (items.length > 0) basketScopes.push("shop");
      if (sessions.length > 0) basketScopes.push("games");

      const q = await quote({
        code: input.discount_code,
        scope: basketScopes.length > 0 ? basketScopes : ["shop", "games"],
        subtotalPaise: goods + courtTime,
        productSubtotalPaise: goods,
        slotSubtotalPaise: courtTime,
        userId: session?.id ?? null,
      });
      if (!q.ok) return NextResponse.json({ error: q.error }, { status: 409 });

      const redemptionScope = items.length > 0 ? "shop" : "games";
      const claimed = await redeem({
        codeId: q.code.id,
        userId: session?.id ?? null,
        scope: redemptionScope,
        reference,
        discountPaise: q.discountPaise,
      });
      if (!claimed) return NextResponse.json({ error: "That code was just fully claimed." }, { status: 409 });
      discountPaise = q.discountPaise;
      discountCode = q.code.code;
      releaseOnFailure = { codeId: q.code.id, reference };
    }

    const totals = priceBasket({ lines: priced, shippingPaise: shipping, discountPaise });

    const isFree = totals.totalPaise === 0;
    const wantsWallet = !isFree && input.payment_method === "wallet";
    if (wantsWallet && !session) {
      return NextResponse.json({ error: "Sign in to pay from your wallet." }, { status: 401 });
    }
    if (wantsWallet && session) {
      const charge = await chargeWallet({
        userId: session.id, amountPaise: totals.totalPaise, kind: "order",
        reason: `SuperPro basket ${reference}`, refTable: "orders",
      });
      if (!charge.ok) {
        return NextResponse.json({ error: charge.error, wallet_balance_paise: charge.balancePaise }, { status: 409 });
      }
      refundOnFailure = { userId: session.id, amountPaise: totals.totalPaise, reference };
    }

    const wantsOnline = !isFree && !wantsWallet && input.payment_method === "razorpay" && isRazorpayEnabled;
    const method = isFree ? "free" : wantsWallet ? "wallet" : wantsOnline ? "razorpay" : items.length > 0 ? "cod" : "venue";
    const paymentStatus = isFree || wantsWallet ? "paid" : "pending";

    let orderId: string | null = null;
    if (items.length > 0) {
      const rows = await query<{ id: string }>(
        `INSERT INTO orders (order_no, user_id, customer_name, customer_phone, customer_email, items,
           subtotal_paise, shipping_paise, convenience_fee_paise, discount_paise, discount_code, total_paise,
           delivery_mode, address, payment_method, payment_status, fulfillment_status, notes)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,'new',$17)
         RETURNING id`,
        [
          reference, session?.id ?? null, input.customer_name, input.customer_phone,
          input.customer_email || null, JSON.stringify(items),
          goods, shipping, totals.convenienceFeePaise, discountPaise, discountCode, totals.totalPaise,
          input.delivery_mode, input.address ? JSON.stringify(input.address) : null,
          method, paymentStatus, input.notes ?? null,
        ],
      );
      orderId = rows[0].id;
      // The trail starts at placement, so the order's history is complete
      // rather than beginning at whatever an admin happened to do first.
      await query(
        `INSERT INTO order_events (order_id, status, note, created_by) VALUES ($1,'new',$2,'system')`,
        [orderId, "Order placed"],
      ).catch(() => {});
    }

    let gatedCount = 0;
    if (session && sessions.length > 0) {
      const profile = await queryOne<{ skill_level: string }>(
        `SELECT skill_level FROM users WHERE id = $1`, [session.id],
      );
      const res = await insertRegistrations({
        sessions, reference, orderRef: reference, userId: session.id,
        playerName: input.customer_name, playerPhone: input.customer_phone,
        playerEmail: input.customer_email || null,
        skillLevel: profile?.skill_level ?? "beginner",
        method, paymentStatus, notes: input.notes ?? null,
      });
      gatedCount = res.gatedCount;
    }

    let razorpayOrderId: string | null = null;
    if (wantsOnline) {
      try {
        const rzp = await createRazorpayOrder({
          amountPaise: totals.totalPaise,
          receipt: reference,
          notes: {
            reference,
            items: String(items.length),
            slots: String(sessions.length),
            discount_code: discountCode ?? "none",
            discount_paise: String(discountPaise),
          },
        });
        razorpayOrderId = rzp.id;
        if (orderId) await query(`UPDATE orders SET razorpay_order_id = $1 WHERE id = $2`, [rzp.id, orderId]);
        if (sessions.length > 0) {
          await query(`UPDATE game_registrations SET razorpay_order_id = $1 WHERE reference = $2`, [rzp.id, reference]);
        }
      } catch (err) {
        console.error("[checkout] razorpay order failed, falling back:", err);
      }
    }

    refundOnFailure = null;
    releaseOnFailure = null;
    // The basket has become records; it should not survive the checkout.
    if (session) await query(`DELETE FROM carts WHERE user_id = $1`, [session.id]).catch(() => {});

    return NextResponse.json({
      ok: true,
      reference,
      order_id: orderId,
      order_no: items.length > 0 ? reference : null,
      slots_booked: sessions.length,
      slots_pending_approval: gatedCount,
      product_subtotal_paise: totals.productSubtotalPaise,
      slot_subtotal_paise: totals.slotSubtotalPaise,
      convenience_fee_paise: totals.convenienceFeePaise,
      shipping_paise: totals.shippingPaise,
      discount_paise: totals.discountPaise,
      discount_code: discountCode,
      total_paise: totals.totalPaise,
      payment_method: method,
      razorpay_order_id: razorpayOrderId,
    });
  } catch (err) {
    console.error("[checkout]", err);
    // Money must never leave a wallet without records to show for it, and a
    // basket that failed must not burn one of a code's limited uses.
    if (refundOnFailure) {
      await adjustWallet({
        userId: refundOnFailure.userId, deltaPaise: refundOnFailure.amountPaise, kind: "refund",
        reason: `Auto-refund - checkout ${refundOnFailure.reference} failed`, createdBy: "system",
      }).catch((e) => console.error("[checkout] auto-refund failed:", e));
    }
    if (releaseOnFailure) {
      await releaseRedemption(releaseOnFailure.codeId, releaseOnFailure.reference).catch(() => {});
    }
    return NextResponse.json({ error: "Could not complete the checkout. Please try again." }, { status: 500 });
  }
}
