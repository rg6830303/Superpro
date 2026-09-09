"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { ListState, submitResource } from "@/components/admin/crud";
import { Trash2 } from "lucide-react";
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
  created_at: string;
};

const FULFILMENT = ["new", "packed", "shipped", "delivered", "cancelled"];
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
      <AdminHeader title="Orders" sub="Shop orders, payment state and fulfilment." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Orders" value={orders.length} />
        <StatTile label="Awaiting packing" value={unfulfilled} tone={unfulfilled > 0 ? "accent" : "default"} />
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

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50" htmlFor={`ful-${o.id}`}>
                  Fulfilment
                </label>
                <select
                  id={`ful-${o.id}`}
                  defaultValue={o.fulfillment_status}
                  className="field w-auto px-3 py-1.5 text-sm capitalize"
                  onChange={async (e) => {
                    await submitResource("/api/admin/orders", "PATCH", {
                      id: o.id,
                      fulfillment_status: e.target.value,
                    });
                    load(filter);
                  }}
                >
                  {FULFILMENT.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50" htmlFor={`pay-${o.id}`}>
                  Payment
                </label>
                <select
                  id={`pay-${o.id}`}
                  defaultValue={o.payment_status}
                  className="field w-auto px-3 py-1.5 text-sm capitalize"
                  onChange={async (e) => {
                    await submitResource("/api/admin/orders", "PATCH", {
                      id: o.id,
                      payment_status: e.target.value,
                    });
                    load(filter);
                  }}
                >
                  {PAYMENT.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
