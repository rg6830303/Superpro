import type { Metadata } from "next";
import { asLines } from "@/lib/orders";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Circle, MessageCircle, Package, Truck } from "lucide-react";
import { CelebrationMark } from "@/components/celebrate";
import { query, queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { formatPaise } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";
import { waLink } from "@/lib/site";
import { CONVENIENCE_FEE_RATE } from "@/lib/fees";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

type OrderRow = {
  id: string;
  order_no: string;
  customer_name: string;
  items: Array<{ name: string; qty: number; price_paise: number }>;
  subtotal_paise: number;
  shipping_paise: number;
  convenience_fee_paise: number;
  discount_paise: number;
  discount_code: string | null;
  total_paise: number;
  delivery_mode: "pickup" | "delivery";
  payment_method: string;
  payment_status: string;
  fulfillment_status: string;
  courier: string | null;
  tracking_ref: string | null;
  delivery_note: string | null;
};

type SlotRow = {
  session_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  court_number: number | null;
  amount_paise: number;
  status: string;
};

type EventRow = { status: string; note: string | null; courier: string | null; created_at: string };

/** The delivery journey, in the order the console drives it. */
const JOURNEY = [
  { key: "new", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

const REACHED: Record<string, number> = {
  new: 0, confirmed: 1, packed: 1, dispatched: 2, shipped: 2, delivered: 3,
};

/**
 * Confirmation for a whole basket.
 *
 * One reference can cover gear, court slots, or both, so the page is keyed on
 * the reference rather than on an order row — a slot-only checkout has no
 * order to look up. Everything the admin later changes is read live, which is
 * what makes this double as the player's order-tracking page.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const ref = orderNo.toUpperCase();
  await ensureSchema();

  const [order, slots] = await Promise.all([
    queryOne<OrderRow>(
      `SELECT id, order_no, customer_name, items, subtotal_paise, shipping_paise,
              COALESCE(convenience_fee_paise, 0) AS convenience_fee_paise,
              COALESCE(discount_paise, 0) AS discount_paise, discount_code, total_paise,
              delivery_mode, payment_method, payment_status, fulfillment_status,
              courier, tracking_ref, delivery_note
       FROM orders WHERE order_no = $1 LIMIT 1`,
      [ref],
    ).catch(() => null),
    query<SlotRow>(
      `SELECT s.session_date::text AS session_date, s.start_time, s.end_time, v.name AS venue_name,
              COALESCE(r.court_number, s.court_number) AS court_number, r.amount_paise, r.status
       FROM game_registrations r
       JOIN game_sessions s ON s.id = r.session_id
       JOIN venues v ON v.id = s.venue_id
       WHERE r.reference = $1 OR r.order_ref = $1
       ORDER BY s.session_date, s.start_time`,
      [ref],
    ).catch(() => []),
  ]);

  if (!order && slots.length === 0) notFound();

  const events = order
    ? await query<EventRow>(
        `SELECT status, note, courier, created_at::text AS created_at
         FROM order_events WHERE order_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [order.id],
      ).catch(() => [])
    : [];

  const paid = order ? order.payment_status === "paid" : slots.some((s) => s.status === "confirmed");
  const items = asLines(order?.items);
  const reached = order ? (REACHED[order.fulfillment_status] ?? 0) : -1;
  const pendingApproval = slots.filter((s) => s.status === "pending_approval").length;

  return (
    <div className="wrap section max-w-3xl">
      <div className="text-center">
        <CelebrationMark />
        <p className="eyebrow mt-6">{paid ? "Paid" : "Confirmed"}</p>
        <h1 className="mt-3 headline-page">Thanks{order ? `, ${order.customer_name.split(" ")[0]}` : ""}</h1>
        <p className="mt-3 font-mono text-sm text-volt-deep">{ref}</p>
      </div>

      {/* Court time first: it has a date attached, so it is the part with a
          deadline the player needs to see. */}
      {slots.length > 0 && (
        <section className="card mt-8 p-6">
          <h2 className="flex items-center gap-2 text-2xl">
            <CalendarDays size={18} className="text-volt-deep" /> Your court time
          </h2>
          <ul className="mt-4 space-y-3">
            {slots.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-4 border-b border-line/60 pb-3 last:border-0">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{s.venue_name}</p>
                  <p className="text-sm text-ink/65">
                    {formatDate(s.session_date)} · {formatTime(s.start_time)}
                    {s.court_number ? ` · Court ${s.court_number}` : ""}
                  </p>
                </div>
                <span className={s.status === "pending_approval" ? "chip-warn shrink-0" : "chip-volt shrink-0"}>
                  {s.status === "pending_approval" ? "Awaiting approval" : "Confirmed"}
                </span>
              </li>
            ))}
          </ul>
          {pendingApproval > 0 && (
            <p className="mt-4 rounded-lg bg-amber/10 px-3 py-2.5 text-xs leading-relaxed text-ink/70">
              {pendingApproval} of these is above your band, so an admin approves it before you appear on the
              roster. You will see it change here the moment they do.
            </p>
          )}
        </section>
      )}

      {/* Delivery journey, driven by the console and read live here. */}
      {order && items.length > 0 && (
        <section className="card mt-6 p-6">
          <h2 className="flex items-center gap-2 text-2xl">
            <Package size={18} className="text-volt-deep" /> Your gear
          </h2>

          <ol className="mt-5 flex flex-wrap gap-y-4">
            {JOURNEY.map((step, i) => {
              const done = i <= reached;
              return (
                <li key={step.key} className="flex min-w-[46%] items-center gap-2 sm:min-w-0 sm:flex-1">
                  <span className={done ? "text-volt-deep" : "text-ink/25"}>
                    {done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                  </span>
                  <span className={`text-xs font-semibold ${done ? "text-ink" : "text-ink/40"}`}>{step.label}</span>
                  {i < JOURNEY.length - 1 && (
                    <span className={`hidden h-px flex-1 sm:block ${i < reached ? "bg-volt" : "bg-line"}`} />
                  )}
                </li>
              );
            })}
          </ol>

          {(order.courier || order.tracking_ref || order.delivery_note) && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-mist px-3 py-2.5 text-xs leading-relaxed text-ink/75">
              <Truck size={14} className="mt-0.5 shrink-0 text-volt-deep" />
              <span>
                {order.courier && <strong>{order.courier}</strong>}
                {order.tracking_ref && <> · {order.tracking_ref}</>}
                {order.delivery_note && <span className="block text-ink/60">{order.delivery_note}</span>}
              </span>
            </p>
          )}

          <ul className="mt-5 space-y-2 text-sm">
            {items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-ink/75">
                  {it.name} × {it.qty}
                </span>
                <span className="text-ink">{formatPaise(it.price_paise * it.qty)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-6 p-6">
        <h2 className="text-2xl">What you paid</h2>
        <dl className="mt-4 space-y-2.5 text-sm">
          {order && (
            <div className="flex justify-between">
              <dt className="text-ink/70">Gear</dt>
              <dd className="text-ink">{formatPaise(order.subtotal_paise)}</dd>
            </div>
          )}
          {slots.length > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink/70">Court time</dt>
              <dd className="text-ink">
                {formatPaise(slots.reduce((sum, s) => sum + Number(s.amount_paise), 0))}
              </dd>
            </div>
          )}
          {order && order.discount_paise > 0 && (
            <div className="flex justify-between">
              <dt className="text-volt-deep">{order.discount_code ?? "Discount"}</dt>
              <dd className="text-volt-deep">-{formatPaise(order.discount_paise)}</dd>
            </div>
          )}
          {order && order.convenience_fee_paise > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink/70">
                Convenience fee
                <span className="block text-[11px] text-ink/45">
                  {(CONVENIENCE_FEE_RATE * 100).toFixed(1)}% on gear · court time is exempt
                </span>
              </dt>
              <dd className="text-ink">{formatPaise(order.convenience_fee_paise)}</dd>
            </div>
          )}
          {order && (
            <div className="flex justify-between">
              <dt className="text-ink/70">{order.delivery_mode === "pickup" ? "Pickup" : "Delivery"}</dt>
              <dd className={order.shipping_paise === 0 ? "text-volt-deep" : "text-ink"}>
                {order.shipping_paise === 0 ? "Free" : formatPaise(order.shipping_paise)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-3">
            <dt className="font-display text-xl uppercase text-ink">Total</dt>
            <dd className="font-display text-xl text-volt-deep">
              {formatPaise(
                order
                  ? order.total_paise
                  : slots.reduce((sum, s) => sum + Number(s.amount_paise), 0),
              )}
            </dd>
          </div>
        </dl>
        {order && (
          <p className="mt-3 text-xs text-ink/55">
            {order.payment_status === "paid"
              ? "Paid online."
              : order.payment_method === "cod"
                ? "Pay cash when it arrives."
                : "Pay at the venue."}
          </p>
        )}
      </section>

      {/* The trail the console writes. This is why the page is worth coming
          back to rather than only seeing once. */}
      {events.length > 0 && (
        <section className="card mt-6 p-6">
          <h2 className="text-2xl">Updates</h2>
          <ol className="mt-4 space-y-3">
            {events.map((e, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-line/60 pb-3 text-sm last:border-0">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-volt" />
                <div className="min-w-0">
                  <p className="font-semibold capitalize text-ink">{e.status.replace(/_/g, " ")}</p>
                  {e.note && <p className="text-ink/65">{e.note}</p>}
                  {e.courier && <p className="text-ink/50">{e.courier}</p>}
                  <p className="mt-0.5 font-mono text-[11px] text-ink/40">
                    {new Date(e.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard" className="btn-volt">
          My account
        </Link>
        <a
          href={waLink(`Hi SuperPro! A question about ${ref}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline"
        >
          <MessageCircle size={16} /> Message a rep
        </a>
      </div>
    </div>
  );
}
