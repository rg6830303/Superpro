import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";
import { queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatPaise } from "@/lib/money";
import { waLink } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

type OrderRow = {
  order_no: string;
  customer_name: string;
  items: Array<{ name: string; qty: number; price_paise: number }>;
  subtotal_paise: number;
  shipping_paise: number;
  total_paise: number;
  delivery_mode: "pickup" | "delivery";
  payment_method: string;
  payment_status: string;
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  await ensureSchema();

  const order = await queryOne<OrderRow>(
    `SELECT order_no, customer_name, items, subtotal_paise, shipping_paise, total_paise,
            delivery_mode, payment_method, payment_status
     FROM orders WHERE order_no = $1 LIMIT 1`,
    [orderNo.toUpperCase()],
  ).catch(() => null);

  if (!order) notFound();

  const paid = order.payment_status === "paid";
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="wrap max-w-2xl py-16">
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok text-ink">
          <Check size={28} />
        </div>
        <h1 className="mt-5 text-4xl">{paid ? "Payment received" : "Order placed"}</h1>
        <p className="mt-3 text-sm text-bone/55">
          Thanks {order.customer_name.split(" ")[0]} — your order number is{" "}
          <span className="font-semibold text-gold">{order.order_no}</span>.
          {paid
            ? " We're packing it now."
            : order.delivery_mode === "pickup"
              ? " Pay when you collect it at TurfXL."
              : " Pay cash when it arrives."}
        </p>

        <ul className="mt-7 space-y-2.5 border-t border-white/10 pt-6 text-left text-sm">
          {items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-4">
              <span className="text-bone/70">
                {i.qty} × {i.name}
              </span>
              <span className="text-bone/80">{formatPaise(i.price_paise * i.qty)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 border-t border-white/10 pt-3">
            <span className="text-bone/55">{order.delivery_mode === "pickup" ? "Pickup" : "Delivery"}</span>
            <span className="text-bone/80">
              {order.shipping_paise === 0 ? "Free" : formatPaise(order.shipping_paise)}
            </span>
          </li>
          <li className="flex justify-between gap-4 pt-1">
            <span className="font-display text-xl uppercase text-bone">Total</span>
            <span className="font-display text-xl text-gold">{formatPaise(order.total_paise)}</span>
          </li>
        </ul>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={waLink(`Hi SuperPro! A question about order ${order.order_no}:`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-[#25D366] text-ink hover:brightness-110"
          >
            <MessageCircle size={16} /> Message a rep
          </a>
          <Link href="/products" className="btn-outline">
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
