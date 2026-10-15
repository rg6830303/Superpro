"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { ListState } from "@/components/admin/crud";
import { useUrlTab } from "@/components/admin/use-url-tab";
import { Alert, Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { OPEN, OPEN_CATEGORIES } from "@/lib/sparvic-open";
import type { OpenEntry } from "@/lib/sparvic-open-server";

type Pair = { id: string; category: string; status: string; message: string | null; team_entry_ref: string | null; created_at: string; requester_id: string; requester_name: string; partner_id: string; partner_name: string };
type Player = { id: string; full_name: string; email: string; phone: string | null; gender: string | null; dupr: number | null; dupr_singles: number | null; dupr_doubles: number | null };

const TABS = ["entries", "pairs", "ratings"] as const;
const label = (id: string) => OPEN_CATEGORIES.find((c) => c.id === id)?.label ?? id;
const n2 = (v: number | null) => (v == null ? "—" : Number(v).toFixed(2));

/** Organiser controls for the Sparvic Open: entries, doubles pairings and players' DUPR ratings. */
export default function AdminSparvicOpenPage() {
  const [tab, setTab] = useUrlTab<(typeof TABS)[number]>("entries", TABS);
  const [entries, setEntries] = useState<OpenEntry[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch("/api/admin/sparvic-open", { cache: "no-store" }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setEntries(d.entries ?? []); setPairs(d.pairs ?? []); setPlayers(d.players ?? []);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(key: string, body: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key); setMsg(null);
    try {
      const res = await fetch("/api/admin/sparvic-open", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Action failed.");
      setMsg({ tone: "ok", text: d.note ?? "Done." });
      await load();
      return true;
    } catch (e) { setMsg({ tone: "error", text: e instanceof Error ? e.message : "Action failed." }); return false; } finally { setBusy(null); }
  }

  const paid = entries.filter((e) => e.payment_status === "paid");
  const perCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of paid) for (const c of e.categories) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return m;
  }, [paid]);

  return (
    <div>
      <AdminHeader title={OPEN.name} sub={`${OPEN.dates} · ${OPEN.venue}. Manage entries, doubles pairings and DUPR ratings. Every change is logged.`} />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Confirmed entries" value={paid.length} />
        <StatTile label="Collected" value={formatPaise(paid.reduce((s, e) => s + e.amount_paise, 0))} tone="accent" />
        <StatTile label="Awaiting payment" value={entries.filter((e) => e.payment_status === "pending").length} />
        <StatTile label="Open pair requests" value={pairs.filter((p) => p.status === "pending").length} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {OPEN_CATEGORIES.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-3 text-sm"><span>{c.label}</span><strong>{perCategory.get(c.id) ?? 0}</strong></div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={tab === t ? "tab tab-active" : "tab"}>
            {t === "entries" ? "Entries" : t === "pairs" ? "Doubles pairings" : "Player ratings"}
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" className="btn-outline btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
        <a href="/api/admin/sparvic-open?format=csv" className="btn-outline btn-sm"><Download size={13} /> Export CSV</a>
      </div>
      {msg && <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}

      {loading || error ? <ListState loading={loading} error={error} empty={false} emptyLabel="" /> : tab === "entries" ? (
        <Entries entries={entries} busy={busy} act={act} />
      ) : tab === "pairs" ? (
        <Pairs pairs={pairs} players={players} busy={busy} act={act} />
      ) : (
        <Ratings players={players} busy={busy} act={act} />
      )}
    </div>
  );
}

type Act = (key: string, body: object, confirmText?: string) => Promise<boolean | undefined>;

function Entries({ entries, busy, act }: { entries: OpenEntry[]; busy: string | null; act: Act }) {
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const list = entries.filter((e) =>
    (status === "all" || e.payment_status === status) &&
    (!cat || e.categories.some((c) => c.category === cat)) &&
    (!q || `${e.reference} ${e.player_name} ${e.player_phone} ${e.player_email} ${e.categories.map((c) => c.partner_name).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder="Search name, phone, ref, partner" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option><option value="paid">Confirmed</option><option value="pending">Awaiting payment</option><option value="cancelled">Cancelled</option>
        </select>
        <select className="field max-w-[260px]" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>{OPEN_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      {list.length === 0 ? <ListState loading={false} error={null} empty emptyLabel="No entries match." /> : (
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead><tr><th>Ref</th><th>Player</th><th>Categories & partners</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.reference}<span className="block text-[10px] text-ink/45">{new Date(e.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span></td>
                  <td><span className="block font-semibold">{e.player_name}</span><span className="block text-xs text-ink/55">{e.player_phone} · {e.player_email}</span></td>
                  <td className="text-xs">
                    {e.categories.map((c) => (
                      <span key={c.category} className="flex items-center gap-2">
                        <span>{label(c.category)}{c.partner_name ? ` — with ${c.partner_name} (DUPR ${c.partner_dupr ?? "—"})` : ""}</span>
                        {e.categories.length > 1 && <button type="button" className="text-signal hover:underline" disabled={!!busy} onClick={() => act(`rm-${e.id}-${c.category}`, { action: "entry_remove_category", reference: e.reference, category: c.category }, `Remove ${label(c.category)} from ${e.reference}? Refund offline if it was paid.`)}>remove</button>}
                      </span>
                    ))}
                  </td>
                  <td>{formatPaise(e.amount_paise)}{e.discount_paise ? <span className="block text-[10px] text-volt-deep">−{formatPaise(e.discount_paise)} early bird</span> : null}</td>
                  <td><span className={e.payment_status === "paid" ? "chip-volt" : "chip"}>{e.payment_status === "paid" ? "Confirmed" : e.payment_status === "pending" ? "Unpaid" : "Cancelled"}</span>
                    {String((e as { razorpay_payment_id?: string }).razorpay_payment_id ?? "").startsWith("manual:") && <span className="block text-[10px] text-ink/45">marked manually</span>}</td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {e.payment_status === "pending" && <button type="button" className="btn-volt btn-sm" disabled={!!busy} onClick={() => { const note = window.prompt("Mark as paid (cash/transfer). Optional note:") ?? undefined; if (note !== undefined) act(`pay-${e.id}`, { action: "entry_mark_paid", reference: e.reference, note: note || undefined }); }}>{busy === `pay-${e.id}` ? <Spinner /> : null} Mark paid</button>}
                      {e.payment_status === "paid" && <button type="button" className="btn-outline btn-sm" disabled={!!busy} onClick={() => act(`mail-${e.id}`, { action: "entry_resend_email", reference: e.reference })}>Resend email</button>}
                      {e.payment_status !== "cancelled" && <button type="button" className="btn-outline btn-sm" disabled={!!busy} onClick={() => { const note = window.prompt(`Cancel ${e.reference}? Optional note to the player:`); if (note !== null) act(`cx-${e.id}`, { action: "entry_cancel", reference: e.reference, note: note || undefined }); }}>Cancel</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pairs({ pairs, players, busy, act }: { pairs: Pair[]; players: Player[]; busy: string | null; act: Act }) {
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({ category: OPEN_CATEGORIES.find((c) => c.type === "doubles")!.id, a: "", b: "", force: false });
  const list = pairs.filter((p) => status === "all" || p.status === status);
  const opt = players.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.gender ?? "?"} · D {n2(p.dupr_doubles ?? p.dupr)}</option>);
  return (
    <div className="mt-4 space-y-5">
      <section className="card p-5">
        <p className="eyebrow">Pair two players manually</p>
        <div className="mt-3 grid gap-2 lg:grid-cols-4">
          <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {OPEN_CATEGORIES.filter((c) => c.type === "doubles").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select className="field" value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })}><option value="">Player 1</option>{opt}</select>
          <select className="field" value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })}><option value="">Player 2</option>{opt}</select>
          <button type="button" className="btn-volt" disabled={!form.a || !form.b || !!busy} onClick={async () => { if (await act("pair-new", { action: "pair_create", category: form.category, requester_id: form.a, partner_id: form.b, force: form.force })) setForm({ ...form, a: "", b: "", force: false }); }}>
            {busy === "pair-new" ? <Spinner /> : null} Pair them
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-ink/70"><input type="checkbox" checked={form.force} onChange={(e) => setForm({ ...form, force: e.target.checked })} /> Override DUPR / gender rules (logged)</label>
        <p className="mt-1 text-[11px] text-ink/50">Both players are notified and emailed; any other open requests of theirs in this category are closed.</p>
      </section>

      <div className="flex gap-2">
        {["all", "pending", "accepted", "declined", "cancelled"].map((s) => (
          <button key={s} type="button" className={status === s ? "tab tab-active" : "tab"} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
        ))}
      </div>
      {list.length === 0 ? <ListState loading={false} error={null} empty emptyLabel="No pairings." /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Category</th><th>Requested by</th><th>Partner</th><th>Status</th><th>Team entry</th><th>Set status</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs">{label(p.category)}<span className="block text-[10px] text-ink/45">{new Date(p.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span></td>
                  <td>{p.requester_name}</td>
                  <td>{p.partner_name}</td>
                  <td><span className={p.status === "accepted" ? "chip-volt" : "chip"}>{p.status}</span></td>
                  <td className="font-mono text-xs">{p.team_entry_ref ?? "—"}</td>
                  <td>
                    <select className="field min-w-[130px]" value={p.status} disabled={!!busy || Boolean(p.team_entry_ref)} onChange={(e) => act(`ps-${p.id}`, { action: "pair_status", id: p.id, status: e.target.value }, `Set this pairing to "${e.target.value}"? Both players are notified.`)}>
                      {["pending", "accepted", "declined", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Ratings({ players, busy, act }: { players: Player[]; busy: string | null; act: Act }) {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Record<string, { s: string; d: string }>>({});
  const list = players.filter((p) => !q || `${p.full_name} ${p.email} ${p.phone}`.toLowerCase().includes(q.toLowerCase()));
  const val = (p: Player) => edit[p.id] ?? { s: p.dupr_singles != null ? String(p.dupr_singles) : "", d: p.dupr_doubles != null ? String(p.dupr_doubles) : "" };
  return (
    <div className="mt-4">
      <input className="field max-w-xs" placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="mt-2 text-[11px] text-ink/50">Verify against DUPR (as on {OPEN.duprAsOf}). Singles categories use the singles rating; doubles use the doubles rating.</p>
      <div className="table-wrap mt-3">
        <table className="tbl">
          <thead><tr><th>Player</th><th>Gender</th><th>Old rating</th><th>Singles</th><th>Doubles</th><th /></tr></thead>
          <tbody>
            {list.map((p) => {
              const v = val(p);
              return (
                <tr key={p.id}>
                  <td><span className="block font-semibold">{p.full_name}</span><span className="block text-xs text-ink/55">{p.email}</span></td>
                  <td className="capitalize">{p.gender ?? "—"}</td>
                  <td>{n2(p.dupr)}</td>
                  <td><input className="field w-24" inputMode="decimal" value={v.s} onChange={(e) => setEdit({ ...edit, [p.id]: { ...v, s: e.target.value } })} /></td>
                  <td><input className="field w-24" inputMode="decimal" value={v.d} onChange={(e) => setEdit({ ...edit, [p.id]: { ...v, d: e.target.value } })} /></td>
                  <td>
                    {edit[p.id] && <button type="button" className="btn-volt btn-sm" disabled={!!busy} onClick={async () => {
                      if (await act(`r-${p.id}`, { action: "rating_set", user_id: p.id, dupr_singles: v.s ? Number(v.s) : null, dupr_doubles: v.d ? Number(v.d) : null })) setEdit((x) => { const y = { ...x }; delete y[p.id]; return y; });
                    }}>Save</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
