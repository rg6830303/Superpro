"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import type { Registration } from "@/lib/coaching-registrations";
import type { CoachGroup } from "@/lib/coach-program-data";
import { DAYS, SKILLS, TIMINGS, VENUES, venueById, formatRupees } from "@/lib/coaching-program";

type Props = { registrations: Registration[]; groups: (CoachGroup & { dates: string[] })[] };
type Tab = "registrations" | "groups" | "calendar";

const STATUS: Record<Registration["status"], { label: string; cls: string }> = {
  registered: { label: "Registered", cls: "bg-mist text-ink/70" },
  grouped: { label: "Grouped", cls: "bg-sky-100 text-sky-800" },
  confirmed: { label: "Confirmed", cls: "bg-volt-soft text-volt-deep" },
  cancelled: { label: "Cancelled", cls: "bg-signal/10 text-signal" },
};

const skillLabel = (id: string) => SKILLS.find((s) => s.id === id)?.label.split(" — ")[0] ?? id;
const venueName = (id: string) => venueById(id)?.name ?? id;
const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const to12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function Tally({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map(([k, n]) => (
          <li key={k} className="grid grid-cols-[6.5rem_1fr_1.5rem] items-center gap-2 text-xs">
            <span className="truncate text-ink/75">{k}</span>
            <span className="h-2 overflow-hidden rounded-full bg-mist">
              <span className="block h-full rounded-full bg-volt" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="text-right font-mono tabular-nums text-ink/70">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CoachProgramBoard({ registrations: initialRegs, groups }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("registrations");
  const [regs, setRegs] = useState(initialRegs);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | Registration["status"] | "all">("active");
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const active = regs.filter((r) => r.status !== "cancelled");
  const unassigned = active.filter((r) => !r.group_id);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return regs.filter((r) => {
      if (statusFilter === "active" && r.status === "cancelled") return false;
      if (statusFilter !== "active" && statusFilter !== "all" && r.status !== statusFilter) return false;
      if (payFilter === "paid" && r.payment_status !== "paid") return false;
      if (payFilter === "unpaid" && r.payment_status === "paid") return false;
      if (needle && !`${r.name} ${r.phone} ${r.reference}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [regs, q, statusFilter, payFilter]);

  // Demand among players still waiting for a group — what to form next.
  const demand = useMemo(() => {
    const count = (pick: (r: Registration) => string[], keys: readonly string[], label = (k: string) => k) =>
      keys.map((k) => [label(k), unassigned.filter((r) => pick(r).includes(k)).length] as [string, number]);
    return {
      days: count((r) => r.days, DAYS, (d) => d.slice(0, 3)),
      timings: count((r) => r.timings, TIMINGS),
      venues: count((r) => r.venues, VENUES.map((v) => v.id), venueName),
      skills: count((r) => [r.skill], SKILLS.map((s) => s.id), skillLabel),
    };
  }, [unassigned]);

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    setSaving(id);
    try {
      const res = await fetch("/api/coach/registrations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update.");
      setRegs((list) => list.map((r) => (r.id === id ? { ...r, ...data.registration } : r)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setSaving(null);
    }
  }

  const paidCount = regs.filter((r) => r.payment_status === "paid").length;
  const revenue = regs.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.amount_paise, 0) / 100;

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Registrations", value: active.length },
          { label: "Waiting for a group", value: unassigned.length },
          { label: "Paid", value: `${paidCount}` },
          { label: "Collected", value: formatRupees(revenue) },
        ].map((t) => (
          <div key={t.label} className="card p-4 sm:p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">{t.label}</p>
            <p className="mt-1 font-display text-3xl text-ink">{t.value}</p>
          </div>
        ))}
      </div>

      <div role="tablist" className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {(
          [
            ["registrations", `Registrations (${active.length})`],
            ["groups", `Groups (${groups.length})`],
            ["calendar", "Class calendar"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
              tab === key ? "border-volt-deep text-ink" : "border-transparent text-ink/55 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {tab === "registrations" && (
        <div className="mt-6 space-y-6">
          {unassigned.length > 0 && (
            <div className="card p-5">
              <p className="font-semibold text-ink">Demand from {unassigned.length} players waiting for a group</p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Tally title="Days" rows={demand.days} />
                <Tally title="Timings" rows={demand.timings} />
                <Tally title="Venues" rows={demand.venues} />
                <Tally title="Level" rows={demand.skills} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input className="field !pl-9" placeholder="Search name, phone or reference" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <select className="field sm:w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="active">All active</option>
              <option value="registered">Registered</option>
              <option value="grouped">Grouped</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">Everything</option>
            </select>
            <select className="field sm:w-36" value={payFilter} onChange={(e) => setPayFilter(e.target.value as typeof payFilter)}>
              <option value="all">Any payment</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Not paid</option>
            </select>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink/55">
              {regs.length === 0 ? "No registrations yet. Share the registration link and they'll appear here." : "Nothing matches these filters."}
            </p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {shown.map((r) => (
                <li key={r.id} className="card min-w-0 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{r.name}</p>
                      <p className="text-xs text-ink/55">
                        {r.age} yrs · {r.gender} · {skillLabel(r.skill)} · <span className="font-mono">{r.reference}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                      <span className={`rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${r.payment_status === "paid" ? "bg-volt text-ink" : "bg-signal/10 text-signal"}`}>
                        {r.payment_status === "paid" ? `Paid ${formatRupees(r.amount_paise / 100)}` : "Unpaid"}
                      </span>
                    </div>
                  </div>

                  <dl className="mt-3 space-y-1 text-xs text-ink/70">
                    <div><dt className="inline text-ink/45">Days: </dt><dd className="inline">{r.days.map((d) => d.slice(0, 3)).join(", ")}</dd></div>
                    <div><dt className="inline text-ink/45">Times: </dt><dd className="inline">{r.timings.join(", ")}</dd></div>
                    <div><dt className="inline text-ink/45">Venues: </dt><dd className="inline">{r.venues.map(venueName).join(", ")}</dd></div>
                    <div><dt className="inline text-ink/45">Emergency: </dt><dd className="inline">{r.emergency_phone} ({r.emergency_relation})</dd></div>
                  </dl>
                  {r.medical && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {r.medical}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`tel:+91${r.phone}`} className="btn-outline btn-sm"><Phone size={13} /> {r.phone}</a>
                    <a href={`https://wa.me/91${r.phone}`} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm"><MessageCircle size={13} /> WhatsApp</a>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                    <select
                      aria-label="Group"
                      className="field !py-2 text-sm"
                      value={r.group_id ?? ""}
                      disabled={saving === r.id}
                      onChange={(e) => void patch(r.id, { group_id: e.target.value || null, ...(e.target.value ? {} : { status: "registered" }) })}
                    >
                      <option value="">No group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Status"
                      className="field !py-2 text-sm"
                      value={r.status}
                      disabled={saving === r.id}
                      onChange={(e) => void patch(r.id, { status: e.target.value })}
                    >
                      <option value="registered">Registered</option>
                      <option value="grouped">Grouped</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  {saving === r.id && <p className="mt-2 flex items-center gap-2 text-xs text-ink/50"><Spinner /> Saving…</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "groups" && <GroupsPanel groups={groups} regs={regs} onError={setError} />}
      {tab === "calendar" && <ClassCalendar groups={groups} />}
    </section>
  );
}

function GroupsPanel({ groups, regs, onError }: { groups: Props["groups"]; regs: Registration[]; onError: (e: string | null) => void }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(groups.length === 0);
  const [form, setForm] = useState({ name: "", venue: VENUES[0].id, days: [] as string[], start_time: "18:00", end_time: "19:00", starts_on: today, sessions: 8 });
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/coach/groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create the group.");
      setForm((f) => ({ ...f, name: "", days: [] }));
      setOpen(false);
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not create the group.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Its players go back to "Registered".`)) return;
    const res = await fetch(`/api/coach/groups?id=${id}`, { method: "DELETE" });
    if (!res.ok) onError("Could not delete the group.");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-volt btn-sm"><Plus size={14} /> New group</button>
      ) : (
        <form onSubmit={create} className="card space-y-4 p-5">
          <p className="font-semibold text-ink">New group</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="g-name">Name</label>
              <input id="g-name" className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Beginners · Turf XL · Evening" />
            </div>
            <div>
              <label className="label" htmlFor="g-venue">Venue</label>
              <select id="g-venue" className="field" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}>
                {VENUES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="g-start">Start time</label>
              <input id="g-start" type="time" className="field" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="g-end">End time</label>
              <input id="g-end" type="time" className="field" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="g-date">First class</label>
              <input id="g-date" type="date" className="field" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="g-sessions">Classes</label>
              <input id="g-sessions" type="number" min={1} max={40} className="field" value={form.sessions} onChange={(e) => setForm({ ...form, sessions: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <p className="label">Days</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = form.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setForm({ ...form, days: on ? form.days.filter((x) => x !== d) : [...form.days, d] })}
                    className={`min-h-10 rounded-pill border px-3.5 text-sm ${on ? "border-volt-deep bg-volt-soft font-semibold" : "border-line text-ink/70"}`}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-volt btn-sm">{busy ? <Spinner /> : null} Create group</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-outline btn-sm">Cancel</button>
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink/55">
          No groups yet. Create one, then assign players to it from the Registrations tab.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {groups.map((g) => {
            const members = regs.filter((r) => r.group_id === g.id && r.status !== "cancelled");
            const next = g.dates.find((d) => d >= new Date().toISOString().slice(0, 10));
            return (
              <li key={g.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{g.name}</p>
                    <p className="text-xs text-ink/55">
                      {venueName(g.venue)} · {g.days.map((d) => d.slice(0, 3)).join(", ")} · {to12(g.start_time)}–{to12(g.end_time)}
                    </p>
                  </div>
                  <button type="button" onClick={() => void remove(g.id, g.name)} aria-label={`Delete ${g.name}`} className="rounded-full p-2 text-ink/40 hover:bg-mist hover:text-signal">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-pill px-2.5 py-1 ${g.members >= 3 ? "bg-volt-soft text-volt-deep" : "bg-amber-50 text-amber-800"}`}>
                    <Users size={12} className="mr-1 inline" /> {g.members} player{g.members === 1 ? "" : "s"}{g.members < 3 ? " · needs 3" : ""}
                  </span>
                  <span className="rounded-pill bg-mist px-2.5 py-1 text-ink/70">{g.paid} paid</span>
                  <span className="rounded-pill bg-mist px-2.5 py-1 text-ink/70">{g.sessions} classes · from {fmtDate(g.starts_on)}</span>
                  {next && <span className="rounded-pill bg-mist px-2.5 py-1 text-ink/70">Next: {fmtDate(next)}</span>}
                </div>
                {members.length > 0 && (
                  <p className="mt-3 text-sm text-ink/70">{members.map((m) => m.name).join(", ")}</p>
                )}
                <details className="mt-3 text-xs text-ink/60">
                  <summary className="cursor-pointer font-semibold text-ink/70">All class dates</summary>
                  <p className="mt-2 leading-relaxed">{g.dates.map(fmtDate).join(" · ")}</p>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ClassCalendar({ groups }: { groups: Props["groups"] }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const todayIso = now.toISOString().slice(0, 10);

  const events = useMemo(() => {
    const map = new Map<string, Props["groups"]>();
    for (const g of groups) for (const d of g.dates) map.set(d, [...(map.get(d) ?? []), g]);
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [groups]);

  const first = new Date(cursor.y, cursor.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - lead + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
  const monthEvents = [...events.entries()].filter(([d]) => d.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`)).sort();
  const shift = (n: number) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="btn-outline btn-sm" aria-label="Previous month"><ChevronLeft size={15} /></button>
        <p className="font-display text-2xl text-ink">{first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        <button type="button" onClick={() => shift(1)} className="btn-outline btn-sm" aria-label="Next month"><ChevronRight size={15} /></button>
      </div>

      {/* Month grid on wider screens */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-line sm:block">
        <div className="grid grid-cols-7 bg-mist text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {DAYS.map((d) => <div key={d} className="py-2">{d.slice(0, 3)}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((iso, i) => (
            <div key={i} className={`min-h-[92px] border-t border-line p-1.5 ${i % 7 ? "border-l" : ""} ${iso ? "bg-paper" : "bg-mist/40"}`}>
              {iso && (
                <>
                  <p className={`text-xs ${iso === todayIso ? "inline-grid h-5 w-5 place-items-center rounded-full bg-ink font-semibold text-paper" : "text-ink/55"}`}>{Number(iso.slice(8))}</p>
                  <div className="mt-1 space-y-1">
                    {(events.get(iso) ?? []).map((g) => (
                      <p key={g.id} title={`${g.name} · ${venueName(g.venue)}`} className="truncate rounded bg-volt-soft px-1.5 py-0.5 text-[11px] font-medium text-ink">
                        {to12(g.start_time)} {g.name}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agenda on phones (and below the grid as a list) */}
      <div className="mt-4 sm:mt-6">
        {monthEvents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink/55">
            <CalendarDays size={18} className="mx-auto mb-2 text-ink/35" /> No classes this month. Create a group to schedule classes.
          </p>
        ) : (
          <ul className="space-y-2 sm:hidden">
            {monthEvents.map(([iso, list]) => (
              <li key={iso} className="card p-4">
                <p className={`text-sm font-semibold ${iso === todayIso ? "text-volt-deep" : "text-ink"}`}>{fmtDate(iso)}{iso === todayIso ? " · Today" : ""}</p>
                {list.map((g) => (
                  <p key={g.id} className="mt-1 text-sm text-ink/70">
                    {to12(g.start_time)}–{to12(g.end_time)} · {g.name} · {venueName(g.venue)} · {g.members} players
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
