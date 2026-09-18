"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { ListState, submitResource } from "@/components/admin/crud";
import { Check, ChevronDown, PackageCheck, Trash2, Truck } from "lucide-react";
import { formatPaise } from "@/lib/money";

type Order = {
  id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  items: Array<{ name: string; qty: number; price_paise: number }>;
  total_paise: number;
  delivery_mode: string;
  payment_method: string;
  payment_status: string;
  fulfillment_status: string;
  address: { line1?: string; line2?: string; city?: string; pincode?: string } | null;
  notes: string | null;
  courier: string | null;
  tracking_ref: string | null;
  delivery_note: string | null;
  convenience_fee_paise: number;
  discount_paise: number;
  discount_code: string | null;
  subtotal_paise: number;
  shipping_paise: number;
  confirmed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  events: Array<{ status: string; note: string | null; courier: string | null; created_by: string | null; created_at: string }>;
  created_at: string;
};

/**
 * The journey an order actually takes, in order. Advancing is one click on the
 * next step rather than hunting through a dropdown, because the common case is
 * moving an order forward, not jumping it somewhere arbitrary.
 */
const JOURNEY = ["new", "confirmed", "dispatched", "delivered"] as const;
const STEP_LABEL: Record<string, string> = {
  new: "Placed",
  confirmed: "Confirm",
  dispatched: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const FULFILMENT = ["new", "confirmed", "dispatched", "delivered", "cancelled"];
const PAYMENT = ["pending", "paid", "failed", "refunded"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async (status = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders${status ? `?status=${status}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load orders.");
      setOrders(data.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  const revenue = orders.filter((o) => o.payment_status === "paid").reduce((n, o) => n + o.total_paise, 0);
  const unfulfilled = orders.filter((o) => o.fulfillment_status === "new").length;

  return (
    <div>
      <AdminHeader title="Orders" sub="Gear orders — confirm, dispatch, deliver. Every change is logged and shown to the customer." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Orders" value={orders.length} />
        <StatTile label="Awaiting confirmation" value={unfulfilled} tone={unfulfilled > 0 ? "accent" : "default"} />
        <StatTile label="Paid revenue" value={formatPaise(revenue)} tone="accent" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {["", ...FULFILMENT].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              filter === s ? "bg-volt text-ink" : "border border-line text-ink/70 hover:text-ink"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <ListState loading={loading} error={error} empty={orders.length === 0} emptyLabel="No orders yet." />

      {!loading && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-volt-deep">{o.order_no}</p>
                  <p className="mt-1 font-display text-2xl uppercase text-ink">{o.customer_name}</p>
                  <p className="text-xs text-ink/65">
                    {o.customer_phone}
                    {o.customer_email ? ` · ${o.customer_email}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-ink/45">
                    {new Date(o.created_at).toLocaleString("en-IN")} ·{" "}
                    {o.delivery_mode === "pickup" ? "Pickup at TurfXL" : "Delivery"} · paid by {o.payment_method}
                  </p>
                </div>
                <p className="font-display text-3xl text-volt-deep">{formatPaise(o.total_paise)}</p>
              </div>

              <ul className="mt-4 space-y-1 border-t border-line pt-4 text-sm text-ink/75">
                {(o.items ?? []).map((i, idx) => (
                  <li key={idx} className="flex justify-between gap-4">
                    <span>
                      {i.qty} × {i.name}
                    </span>
                    <span>{formatPaise(i.price_paise * i.qty)}</span>
                  </li>
                ))}
              </ul>

              {o.address?.line1 && (
                <p className="mt-3 text-xs text-ink/55">
                  {[o.address.line1, o.address.line2, o.address.city, o.address.pincode].filter(Boolean).join(", ")}
                </p>
              )}
              {o.notes && <p className="mt-2 text-xs italic text-ink/55">“{o.notes}”</p>}

              <div className="mt-4 grid gap-1 border-t border-line pt-4 text-xs text-ink/60 sm:max-w-xs">
                <Row label="Items" value={formatPaise(o.subtotal_paise)} />
                {o.discount_paise > 0 && (
                  <Row label={`Discount${o.discount_code ? ` · ${o.discount_code}` : ""}`} value={`− ${formatPaise(o.discount_paise)}`} />
                )}
                {o.convenience_fee_paise > 0 && (
                  <Row label="Convenience fee (2.5%)" value={formatPaise(o.convenience_fee_paise)} />
                )}
                <Row label="Shipping" value={o.shipping_paise > 0 ? formatPaise(o.shipping_paise) : "Free"} />
              </div>

              <OrderLifecycle order={o} onDone={() => load(filter)} />

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50" htmlFor={`pay-${o.id}`}>
                  Payment
                </label>
                <select
                  id={`pay-${o.id}`}
                  defaultValue={o.payment_status}
                  className="field-inline capitalize"
                  onChange={async (e) => {
                    await submitResource("/api/admin/orders", "PATCH", {
                      id: o.id,
                      payment_status: e.target.value,
                    });
                    load(filter);
                  }}
                >
                  {PAYMENT.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  aria-label={`Delete order ${o.order_no}`}
                  title="Delete this order record"
                  onClick={async () => {
                    const err = await submitResource(`/api/admin/orders?id=${o.id}`, "DELETE");
                    if (err) setError(err);
                    load(filter);
                  }}
                  className="ml-auto rounded-md p-2 text-ink/40 transition-colors hover:bg-signal/10 hover:text-signal"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="text-ink/80">{value}</span>
    </div>
  );
}

/**
 * Advancing an order is the whole job of this page, so it gets one primary
 * button — the next step — rather than a dropdown of every state. Courier and
 * tracking are captured at the moment of dispatch, which is the only moment
 * anyone actually knows them, and every change is journalled by the API into
 * order_events so the player's order page shows the same story we do.
 */
function OrderLifecycle({ order, onDone }: { order: Order; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [courier, setCourier] = useState(order.courier ?? "");
  const [tracking, setTracking] = useState(order.tracking_ref ?? "");
  const [note, setNote] = useState("");

  const cancelled = order.fulfillment_status === "cancelled";
  const at = JOURNEY.indexOf(order.fulfillment_status as (typeof JOURNEY)[number]);
  const next = cancelled || at < 0 ? null : JOURNEY[at + 1] ?? null;

  async function advance(status: string) {
    setBusy(true);
    const err = await submitResource("/api/admin/orders", "PATCH", {
      id: order.id,
      fulfillment_status: status,
      ...(courier.trim() ? { courier: courier.trim() } : {}),
      ...(tracking.trim() ? { tracking_ref: tracking.trim() } : {}),
      ...(note.trim() ? { delivery_note: note.trim() } : {}),
    });
    setBusy(false);
    if (!err) {
      setNote("");
      onDone();
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {JOURNEY.map((step, i) => {
          const done = !cancelled && at >= i;
          const stamp =
            step === "confirmed" ? order.confirmed_at : step === "dispatched" ? order.dispatched_at : step === "delivered" ? order.delivered_at : order.created_at;
          return (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  done ? "bg-volt/20 text-volt-deep" : "bg-mist text-ink/40"
                }`}
                title={stamp ? new Date(stamp).toLocaleString("en-IN") : undefined}
              >
                {done && <Check size={11} />}
                {STEP_LABEL[step]}
              </span>
              {i < JOURNEY.length - 1 && <span className="text-ink/20">→</span>}
            </li>
          );
        })}
        {cancelled && (
          <li className="rounded-full bg-signal/10 px-2.5 py-1 text-[11px] font-semibold text-signal">Cancelled</li>
        )}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {next && (
          <button type="button" disabled={busy} onClick={() => advance(next)} className="btn-volt btn-sm disabled:opacity-60">
            {next === "dispatched" ? <Truck size={14} /> : next === "delivered" ? <PackageCheck size={14} /> : <Check size={14} />}
            Mark {STEP_LABEL[next].toLowerCase()}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn btn-sm bg-mist text-ink hover:bg-white"
          aria-expanded={open}
        >
          <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          Delivery details{order.events?.length ? ` · ${order.events.length}` : ""}
        </button>
        {!cancelled && (
          <button
            type="button"
            disabled={busy}
            onClick={() => advance("cancelled")}
            className="text-[11px] text-ink/45 underline hover:text-signal"
          >
            Cancel order
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-line bg-mist/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Courier</span>
              <input value={courier} onChange={(e) => setCourier(e.target.value)} className="field mt-1" placeholder="Delhivery, own rider…" />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Tracking reference</span>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="field mt-1" placeholder="AWB / consignment no." />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Note to the customer</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="field mt-1" placeholder="Leaving the depot this evening." />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => advance(order.fulfillment_status)}
            className="btn btn-sm mt-3 bg-ink text-paper hover:bg-ink/90 disabled:opacity-60"
          >
            Save delivery details
          </button>

          {order.delivery_note && <p className="mt-3 text-xs italic text-ink/60">Current note: “{order.delivery_note}”</p>}

          <div className="mt-4 border-t border-line pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Trail</p>
            {order.events?.length ? (
              <ul className="mt-2 space-y-1.5">
                {order.events.map((ev, i) => (
                  <li key={i} className="text-xs text-ink/65">
                    <span className="font-semibold capitalize text-ink">{STEP_LABEL[ev.status] ?? ev.status}</span>
                    {ev.note ? ` — ${ev.note}` : ""}
                    {ev.courier ? ` · ${ev.courier}` : ""}
                    <span className="text-ink/40">
                      {" "}
                      · {new Date(ev.created_at).toLocaleString("en-IN")}
                      {ev.created_by ? ` · ${ev.created_by}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-ink/45">Nothing recorded yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
