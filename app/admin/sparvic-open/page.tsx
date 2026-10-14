"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { ListState } from "@/components/admin/crud";
import { formatPaise } from "@/lib/money";
import { OPEN, OPEN_CATEGORIES } from "@/lib/sparvic-open";
import type { OpenEntry } from "@/lib/sparvic-open-server";

const label = (id: string) => OPEN_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export default function AdminSparvicOpenPage() {
  const [entries, setEntries] = useState<OpenEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<"paid" | "all">("paid");

  useEffect(() => {
    fetch("/api/admin/sparvic-open")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setEntries(d.entries ?? [])))
      .catch(() => setError("Could not load entries."))
      .finally(() => setLoading(false));
  }, []);

  const paid = entries.filter((e) => e.payment_status === "paid");
  const perCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of paid) for (const c of e.categories) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return m;
  }, [paid]);
  const list = show === "paid" ? paid : entries;

  return (
    <div>
      <AdminHeader title={OPEN.name} sub={`${OPEN.dates} · ${OPEN.venue}. Entries are confirmed once paid on Razorpay.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Confirmed entries" value={paid.length} />
        <StatTile label="Collected" value={formatPaise(paid.reduce((s, e) => s + e.amount_paise, 0))} tone="accent" />
        <StatTile label="Awaiting payment" value={entries.length - paid.length} />
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {OPEN_CATEGORIES.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-3 text-sm">
            <span>{c.label}</span>
            <strong>{perCategory.get(c.id) ?? 0}</strong>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        {(["paid", "all"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setShow(k)} className={show === k ? "tab tab-active" : "tab"}>
            {k === "paid" ? "Confirmed" : "All entries"}
          </button>
        ))}
      </div>

      {loading || error || list.length === 0 ? (
        <ListState loading={loading} error={error} empty={list.length === 0} emptyLabel="No entries yet." />
      ) : (
        <div className="table-wrap mt-4">
          <table className="tbl">
            <thead>
              <tr><th>Ref</th><th>Player</th><th>DUPR</th><th>Categories & partners</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.reference}</td>
                  <td>
                    <span className="block font-semibold">{e.player_name}</span>
                    <span className="block text-xs text-ink/55">{e.player_phone} · {e.player_email}</span>
                  </td>
                  <td>{e.player_dupr != null ? Number(e.player_dupr).toFixed(2) : "—"}</td>
                  <td className="text-xs">
                    {e.categories.map((c) => (
                      <span key={c.category} className="block">
                        {label(c.category)}
                        {c.partner_name ? ` — with ${c.partner_name} (${c.partner_phone}, DUPR ${c.partner_dupr})` : ""}
                      </span>
                    ))}
                  </td>
                  <td>{formatPaise(e.amount_paise)}</td>
                  <td><span className={e.payment_status === "paid" ? "chip-volt" : "chip"}>{e.payment_status === "paid" ? "Confirmed" : "Unpaid"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
