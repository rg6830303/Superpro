"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Clock, TicketPercent, Wallet } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { ListState } from "@/components/admin/crud";
import { formatPaise } from "@/lib/money";

type SourceRow = {
  source: string;
  earned_paise: string;
  owed_paise: string;
  discount_paise: string;
  paid_count: number;
  pending_count: number;
};

type Report = {
  window: string;
  totals: { earned_paise: number; owed_paise: number; discount_paise: number };
  by_source: SourceRow[];
  by_method: Array<{ payment_method: string; paise: string; n: number }>;
  wallet: { topped_up_paise: string; topup_count: number; float_paise: string; pending_count: number } | null;
  series: Array<{ day: string; paise: string }>;
  recent: Array<{
    source: string; reference: string; who: string; amount_paise: number;
    payment_status: string; payment_method: string; discount_code: string | null; created_at: string;
  }>;
  bookings: {
    games_confirmed: number; games_pending: number; games_today: number;
    coaching_open: number; tournament_teams: number; orders_open: number;
  } | null;
};

const WINDOWS = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 days" },
  { key: "month", label: "30 days" },
  { key: "all", label: "All time" },
];

const METHOD_LABEL: Record<string, string> = {
  razorpay: "Paid online",
  wallet: "From wallet credit",
  venue: "Cash at venue",
  cod: "Cash on delivery",
};

export default function AdminRevenuePage() {
  const [win, setWin] = useState("month");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/revenue?window=${win}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load revenue.");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load revenue.");
    } finally {
      setLoading(false);
    }
  }, [win]);

  useEffect(() => {
    load();
  }, [load]);

  const peak = Math.max(1, ...(data?.series ?? []).map((d) => Number(d.paise)));

  return (
    <div>
      <AdminHeader title="Revenue" sub="What the club has earned, what is still owed, and what is on the books." />

      <div className="mb-6 flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => setWin(w.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              win === w.key ? "bg-volt text-ink" : "border border-line text-ink/70 hover:text-ink"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <ListState loading={loading} error={error} empty={false} emptyLabel="" />

      {data && !loading && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Earned" value={formatPaise(data.totals.earned_paise)} tone="accent" hint="Paid bookings and orders" />
            <StatTile label="Still owed" value={formatPaise(data.totals.owed_paise)} hint="Booked, not yet paid" />
            <StatTile label="Discounts given" value={formatPaise(data.totals.discount_paise)} hint="Taken off by codes" />
            <StatTile
              label="Wallet float held"
              value={formatPaise(Number(data.wallet?.float_paise ?? 0))}
              hint="Prepaid credit owed back to players"
            />
          </div>

          {/* Top-ups are cash in, not revenue. Saying so here stops the two
              figures being added together by eye. */}
          <div className="card mb-8 p-5">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
              <Wallet size={13} className="text-volt-deep" /> Wallet top-ups this period
            </p>
            <p className="mt-2 font-display text-3xl text-ink">
              {formatPaise(Number(data.wallet?.topped_up_paise ?? 0))}
              <span className="ml-2 font-sans text-sm font-normal text-ink/55">
                across {data.wallet?.topup_count ?? 0} top-up{(data.wallet?.topup_count ?? 0) === 1 ? "" : "s"}
              </span>
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink/60">
              Cash received, but not earnings. It is credit the club owes back as court time or gear, and it becomes
              revenue only when a player spends it, so it is kept out of the Earned figure rather than counted twice.
              {(data.wallet?.pending_count ?? 0) > 0 && (
                <> {data.wallet?.pending_count} top-up(s) are still awaiting confirmation from Razorpay.</>
              )}
            </p>
          </div>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl">Where it came from</h2>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Source</th><th>Earned</th><th>Paid</th><th>Owed</th><th>Unpaid</th><th>Discounts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_source.map((r) => (
                    <tr key={r.source}>
                      <td className="font-semibold text-ink">{r.source}</td>
                      <td className="font-semibold text-volt-deep">{formatPaise(Number(r.earned_paise))}</td>
                      <td>{r.paid_count}</td>
                      <td className={Number(r.owed_paise) > 0 ? "text-ink" : "text-ink/45"}>
                        {formatPaise(Number(r.owed_paise))}
                      </td>
                      <td>{r.pending_count}</td>
                      <td className="text-ink/55">{formatPaise(Number(r.discount_paise))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mb-8 grid gap-5 lg:grid-cols-2">
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-2xl">
                <Banknote size={18} className="text-volt-deep" /> How it was paid
              </h2>
              {data.by_method.length === 0 ? (
                <p className="mt-3 text-sm text-ink/55">Nothing paid in this period yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.by_method.map((m) => (
                    <li
                      key={m.payment_method}
                      className="flex items-center justify-between gap-3 border-b border-line/60 pb-3 last:border-0"
                    >
                      <span className="text-sm text-ink">{METHOD_LABEL[m.payment_method] ?? m.payment_method}</span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold text-ink">{formatPaise(Number(m.paise))}</span>
                        <span className="block text-[11px] text-ink/45">{m.n} transactions</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-2xl">
                <Clock size={18} className="text-volt-deep" /> On the books
              </h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                {([
                  ["Game bookings confirmed", data.bookings?.games_confirmed ?? 0],
                  ["Waiting on approval", data.bookings?.games_pending ?? 0],
                  ["Playing today", data.bookings?.games_today ?? 0],
                  ["Coaching open", data.bookings?.coaching_open ?? 0],
                  ["Tournament teams", data.bookings?.tournament_teams ?? 0],
                  ["Orders to fulfil", data.bookings?.orders_open ?? 0],
                ] as const).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-ink/60">{label}</dt>
                    <dd className="font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section className="card mb-8 p-6">
            <h2 className="text-2xl">Last 30 days</h2>
            <div className="mt-5 flex h-32 items-end gap-[3px]">
              {data.series.map((d) => {
                const paise = Number(d.paise);
                return (
                  <span
                    key={d.day}
                    title={`${d.day} - ${formatPaise(paise)}`}
                    style={{ height: `${Math.max(2, (paise / peak) * 100)}%` }}
                    className={`min-w-0 flex-1 rounded-t-sm ${paise > 0 ? "bg-volt" : "bg-mist"}`}
                  />
                );
              })}
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              Peak day {formatPaise(peak)}
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl">Everything sold</h2>
            {data.recent.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-ink/55">
                Nothing bought yet.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>When</th><th>Source</th><th>Ref</th><th>Who</th>
                      <th>Amount</th><th>Method</th><th>Code</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r, i) => (
                      <tr key={`${r.reference}-${i}`}>
                        <td className="whitespace-nowrap text-xs text-ink/60">
                          {new Date(r.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td>{r.source}</td>
                        <td className="font-mono text-xs text-volt-deep">{r.reference}</td>
                        <td>{r.who}</td>
                        <td className="font-semibold">{formatPaise(r.amount_paise)}</td>
                        <td className="text-xs">{METHOD_LABEL[r.payment_method] ?? r.payment_method}</td>
                        <td>
                          {r.discount_code ? (
                            <span className="chip">
                              <TicketPercent size={11} /> {r.discount_code}
                            </span>
                          ) : (
                            <span className="text-ink/30">-</span>
                          )}
                        </td>
                        <td>
                          <span className={r.payment_status === "paid" ? "chip-volt" : "chip-warn"}>
                            {r.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
