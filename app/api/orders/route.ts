import { NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { newRef, shippingFor } from "@/lib/money";
import { decrementStock } from "@/lib/orders";
import { createRazorpayOrder, isRazorpayEnabled } from "@/lib/razorpay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatZodError, orderSchema } from "@/lib/validation";
import { orderReceiptMessage, sendWhatsApp } from "@/lib/whatsapp";
import { adjustWallet, chargeWallet } from "@/lib/wallet";

export const runtime = "nodejs";

/**
 * Place a shop order.
 *
 * Prices are re-read from the products table — the cart in the browser is
 * display state only, so a tampered price never reaches the payment gateway.
 */
export async function POST(req: Request) {
  let refundOnFailure: { userId: string; amountPaise: number; orderNo: string } | null = null;
  try {
    const rl = await checkRateLimit(`order:${getClientIp(req)}`, 12, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    const parsed = orderSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;

    await ensureSchema();

    const ids = input.items.map((i) => i.product_id);
    const products = await query<{
      id: string;
      name: string;
      price_paise: number;
      stock: number;
      active: boolean;
    }>(`SELECT id, name, price_paise, stock, active FROM products WHERE id = ANY($1::uuid[])`, [ids]);

    const lines: Array<{ product_id: string; name: string; qty: number; price_paise: number }> = [];
    for (const item of input.items) {
      const p = products.find((row) => row.id === item.product_id);
      if (!p || !p.active) {
        return NextResponse.json({ error: "One of those products is no longer available." }, { status: 409 });
      }
      if (p.stock < item.qty) {
        return NextResponse.json({ error: `Only ${p.stock} × ${p.name} left in stock.` }, { status: 409 });
      }
      lines.push({ product_id: p.id, name: p.name, qty: item.qty, price_paise: p.price_paise });
    }

    const subtotal = lines.reduce((sum, l) => sum + l.price_paise * l.qty, 0);
    const shipping = shippingFor(subtotal, input.delivery_mode);
    const total = subtotal + shipping;

    const orderNo = newRef("SP");
    const session = await getPlayerSession();

    // Wallet is only offered to signed-in customers, and it is debited before
    // the order row is written so a short balance never creates a paid order.
    const wantsWallet = input.payment_method === "wallet";
    if (wantsWallet && !session) {
      return NextResponse.json({ error: "Sign in to pay from your wallet." }, { status: 401 });
    }
    if (wantsWallet && session) {
      const charge = await chargeWallet({
        userId: session.id,
        amountPaise: total,
        kind: "order",
        reason: `Shop order ${orderNo}`,
        refTable: "orders",
      });
      if (!charge.ok) {
        return NextResponse.json(
          { error: charge.error, wallet_balance_paise: charge.balancePaise },
          { status: 409 },
        );
      }
      refundOnFailure = { userId: session.id, amountPaise: total, orderNo };
    }

    // Razorpay is only used when it is configured AND the customer chose it.
    const wantsOnline = !wantsWallet && input.payment_method === "razorpay" && isRazorpayEnabled;
    const method = wantsWallet ? "wallet" : wantsOnline ? "razorpay" : "cod";
    const paymentStatus = wantsWallet ? "paid" : "pending";

    const inserted = await query<{ id: string }>(
      `INSERT INTO orders (order_no, user_id, customer_name, customer_phone, customer_email, items,
         subtotal_paise, shipping_paise, total_paise, delivery_mode, address, payment_method,
         payment_status, fulfillment_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12,$14,'new',$13)
       RETURNING id`,
      [
        orderNo,
        session?.id ?? null,
        input.customer_name,
        input.customer_phone,
        input.customer_email || null,
        JSON.stringify(lines),
        subtotal,
        shipping,
        total,
        input.delivery_mode,
        input.address ? JSON.stringify(input.address) : null,
        method,
        input.notes ?? null,
        paymentStatus,
      ],
    );
    const orderId = inserted[0].id;

    let razorpayOrderId: string | null = null;
    if (wantsOnline) {
      try {
        const rzp = await createRazorpayOrder({
          amountPaise: total,
          receipt: orderNo,
          notes: { order_no: orderNo, customer: input.customer_name },
        });
        razorpayOrderId = rzp.id;
        await query(`UPDATE orders SET razorpay_order_id = $1 WHERE id = $2`, [rzp.id, orderId]);
      } catch (err) {
        console.error("[orders] razorpay order failed, falling back to COD:", err);
        await query(`UPDATE orders SET payment_method = 'cod' WHERE id = $1`, [orderId]);
      }
    }

    // Cash orders are final at this point, so confirm on WhatsApp immediately.
    // Online orders wait for /api/payments/verify.
    if (!razorpayOrderId) {
      await decrementStock(lines);
      // Best-effort receipt: the order is recorded either way.
      await sendWhatsApp({
        kind: "order_receipt",
        target: "number",
        phone: `91${input.customer_phone}`,
        message: orderReceiptMessage({
          name: input.customer_name,
          orderNo,
          items: lines,
          totalPaise: total,
          mode: input.delivery_mode,
        }),
        refTable: "orders",
        refId: orderId,
      });
    }

    refundOnFailure = null;

    return NextResponse.json({
      ok: true,
      order_id: orderId,
      order_no: orderNo,
      total_paise: total,
      razorpay_order_id: razorpayOrderId,
    });
  } catch (err) {
    console.error("[orders]", err);
    // Money must never leave the wallet without an order to show for it.
    if (refundOnFailure) {
      await adjustWallet({
        userId: refundOnFailure.userId,
        deltaPaise: refundOnFailure.amountPaise,
        kind: "refund",
        reason: `Auto-refund — order ${refundOnFailure.orderNo} failed`,
        createdBy: "system",
      }).catch((e) => console.error("[orders] auto-refund failed:", e));
    }
    return NextResponse.json({ error: "Could not place the order. Please try again." }, { status: 500 });
  }
}
