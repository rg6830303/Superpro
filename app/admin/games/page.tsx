"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check, MapPin, MessageSquare, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useUrlTab } from "@/components/admin/use-url-tab";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { Drawer, ListState, RecordEditor, submitResource, type FieldDef } from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";
import { addDays, formatDate, formatTime, istToday, upcomingDates } from "@/lib/dates";
import { formatPaise, perPlayerPaise, splitCaption } from "@/lib/money";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Venue = { id: string; name: string; area: string | null; address: string | null; courts: number; maps_url: string | null; active: boolean; sort_order: number };
type Session = {
  id: string; venue_id: string; venue_name: string; session_date: string; start_time: string; end_time: string;
  court_number: number; level: string; mixed_doubles: boolean; capacity: number; price_paise: number; pricing_mode: string;
  court_fee_paise: number; status: string; notes: string | null; booked: number; waitlist: number; male: number; female: number;
  whatsapp_posted_at: string | null;
};
type Registration = {
  id: string; session_id: string; player_name: string; player_phone: string | null; skill_level: string; players_count: number;
  court_number: number | null; session_court: number; amount_paise: number; payment_method: string; payment_status: string;
  status: string; session_date: string; start_time: string; venue_name: string; gender: string | null; mixed_doubles: boolean; created_at: string;
};
type ApprovalRequest = {
  id: string; player_name: string; player_phone: string; skill_level: string; players_count: number; session_date: string;
  start_time: string; end_time: string; slot_level: string; venue_name: string; capacity: number; confirmed: number;
};
type Tab = "slots" | "upload" | "approvals" | "registrations" | "venues";
const TABS: readonly Tab[] = ["slots", "upload", "approvals", "registrations", "venues"];
const TAB_LABEL: Record<Tab, string> = { slots: "Slots", upload: "Upload slots", approvals: "Approvals", registrations: "Registrations", venues: "Venues" };

const MAX = 5;
const LEVEL_OPTS = [
  { value: "all", label: "Open to all" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "beginner", label: "Beginner" },
];
const levelLabel = (l: string) => LEVEL_OPTS.find((o) => o.value === l)?.label ?? l;
const levelChip = (l: string) => (l === "advanced" ? "bg-ink text-paper" : l === "intermediate" ? "bg-sky-100 text-sky-900" : l === "beginner" ? "bg-amber-100 text-amber-900" : "bg-volt-soft text-volt-deep");

const VENUE_FIELDS: FieldDef[] = [
  { name: "name", label: "Venue name", required: true },
  { name: "area", label: "Area" },
  { name: "address", label: "Address", type: "textarea" },
  { name: "courts", label: "Number of courts", type: "number" },
  { name: "maps_url", label: "Google Maps link", full: true },
  { name: "sort_order", label: "Sort order", type: "number" },
  { name: "active", label: "Listed on the site", type: "checkbox" },
];

const SESSION_FIELDS: FieldDef[] = [
  { name: "start_time", label: "Start time", type: "time", required: true },
  { name: "end_time", label: "End time", type: "time", required: true },
  { name: "court_number", label: "Court number", type: "number", hint: "Shown to players on their booking." },
  { name: "capacity", label: "Players (max 5)", type: "number" },
  { name: "level", label: "Level tag", type: "select", options: LEVEL_OPTS },
  { name: "mixed_doubles", label: "Mixed doubles (max 3 men or 3 women)", type: "checkbox" },
  { name: "pricing_mode", label: "Pricing", type: "select", options: [{ value: "fixed", label: "Fixed price per player" }, { value: "split", label: "Split the court fee" }] },
  { name: "price_rupees", label: "Price per player (₹)", type: "number", hint: "Used when pricing is fixed." },
  { name: "court_fee_rupees", label: "Court fee (₹)", type: "number", hint: "Split evenly across the players." },
  { name: "status", label: "Status", type: "select", options: [{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }, { value: "cancelled", label: "Cancelled" }] },
  { name: "notes", label: "Notes", type: "textarea" },
];

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function AdminGamesPage() {
  const [tab, setTab] = useUrlTab<Tab>("slots", TABS);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [from, setFrom] = useState(istToday());
  const [days, setDays] = useState(14);
  const [venueFilter, setVenueFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("any");
  const [editing, setEditing] = useState<Session | null>(null);
  const [roster, setRoster] = useState<Session | null>(null);
  const [editingVenue, setEditingVenue] = useState<Venue | "new" | null>(null);
  const [posting, setPosting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const to = addDays(from, days - 1);
      const [s, v, a] = await Promise.all([
        fetch(`/api/admin/sessions?from=${from}&to=${to}`).then((r) => r.json()),
        fetch("/api/admin/venues").then((r) => r.json()),
        fetch("/api/admin/approvals").then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      if (v.error) throw new Error(v.error);
      setSessions(s.sessions ?? []);
      setVenues(v.venues ?? []);
      setApprovals(a.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the schedule.");
    } finally {
      setLoading(false);
    }
  }, [from, days]);
  useEffect(() => void load(), [load]);

  const shown = useMemo(
    () => sessions.filter((s) => (venueFilter === "all" || s.venue_id === venueFilter) && (levelFilter === "any" || (levelFilter === "mixed" ? s.mixed_doubles : s.level === levelFilter))),
    [sessions, venueFilter, levelFilter],
  );
  const grouped = useMemo(() => {
    const byDate = new Map<string, Map<string, Session[]>>();
    for (const s of shown) {
      if (!byDate.has(s.session_date)) byDate.set(s.session_date, new Map());
      const m = byDate.get(s.session_date)!;
      if (!m.has(s.venue_name)) m.set(s.venue_name, []);
      m.get(s.venue_name)!.push(s);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shown]);

  const today = istToday();
  const live = sessions.filter((s) => s.status === "open");
  const openSeats = live.reduce((n, s) => n + Math.max(0, Math.min(MAX, s.capacity) - s.booked), 0);
  const waiting = sessions.reduce((n, s) => n + (s.waitlist ?? 0), 0);

  async function postToGroup(id: string) {
    setPosting(id);
    const res = await fetch("/api/admin/whatsapp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "post_slot", session_id: id }) });
    const data = await res.json().catch(() => ({}));
    setPosting(null);
    setNotice(data.ok ? "Posted to the games group." : "Queued — open Admin → WhatsApp to send it with one tap.");
    load();
  }

  async function decide(id: string, action: "approve" | "decline") {
    const res = await fetch("/api/admin/approvals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Could not record that decision.");
    setNotice(action === "approve" ? "Approved — the player has been told." : "Declined — the player has been told.");
    load();
  }

  return (
    <div>
      <AdminHeader
        title="Daily games"
        sub="Court slots across every venue, who's on court, and the waitlist."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTab("upload")} className="btn-primary btn-sm"><CalendarPlus size={14} /> Upload slots</button>
            <button type="button" onClick={() => setEditingVenue("new")} className="btn-outline btn-sm"><MapPin size={13} /> Add venue</button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label="Slots today" value={sessions.filter((s) => s.session_date === today && s.status === "open").length} />
        <StatTile label={`Open seats (${days} days)`} value={openSeats} tone="accent" />
        <StatTile label="On waitlists" value={waiting} tone={waiting ? "warn" : "default"} />
        <StatTile label="Approvals waiting" value={approvals.length} tone={approvals.length ? "warn" : "default"} />
      </div>

      {notice && (
        <div className="mb-5 flex items-start gap-2">
          <div className="flex-1"><Alert tone="ok">{notice}</Alert></div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded-md p-2 text-ink/40 hover:text-ink"><X size={14} /></button>
        </div>
      )}

      <div className="tab-strip mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`tab whitespace-nowrap ${tab === t ? "tab-active" : ""}`}>
            {TAB_LABEL[t]}
            {t === "approvals" && approvals.length > 0 && <span className="ml-2 rounded-pill bg-amber px-1.5 py-0.5 font-mono text-[10px] text-paper">{approvals.length}</span>}
          </button>
        ))}
      </div>

      {tab === "slots" && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <label className="col-span-2 sm:w-auto">
              <span className="label">From</span>
              <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              <span className="label">Show</span>
              <select className="field" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={31}>31 days</option>
              </select>
            </label>
            <label>
              <span className="label">Venue</span>
              <select className="field" value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}>
                <option value="all">All venues</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className="col-span-2 sm:w-auto">
              <span className="label">Tag</span>
              <select className="field" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                <option value="any">Any tag</option>
                {LEVEL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                <option value="mixed">Mixed doubles</option>
              </select>
            </label>
          </div>

          <ListState loading={loading} error={error} empty={shown.length === 0} emptyLabel="No slots in this window. Use Upload slots to add them across venues." />

          {!loading && shown.length > 0 && (
            <div className="space-y-8">
              {grouped.map(([date, byVenue]) => (
                <section key={date}>
                  <h3 className="mb-3 flex items-center gap-2 text-xl">
                    {formatDate(date)}
                    {date === today && <span className="chip-volt py-0 text-[10px]">Today</span>}
                  </h3>
                  <div className="space-y-5">
                    {[...byVenue.entries()].map(([venueName, list]) => (
                      <div key={venueName}>
                        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink/70"><MapPin size={14} /> {venueName}</p>
                        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {list.map((s) => (
                            <SlotCard
                              key={s.id}
                              s={s}
                              posting={posting === s.id}
                              onEdit={() => setEditing(s)}
                              onRoster={() => setRoster(s)}
                              onPost={() => postToGroup(s.id)}
                              onCourt={async (court) => {
                                const err = await submitResource("/api/admin/sessions", "PATCH", { id: s.id, court_number: court });
                                if (err) setError(err);
                                load();
                              }}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "upload" && (
        <SlotPlanner
          venues={venues.filter((v) => v.active)}
          onDone={(msg) => {
            setNotice(msg);
            setTab("slots");
            load();
          }}
        />
      )}

      {tab === "approvals" && (
        <div>
          {approvals.length === 0 ? (
            <p className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink/50">Nothing waiting. Requests appear when a player books a slot tagged above their category.</p>
          ) : (
            <ul className="space-y-3">
              {approvals.map((a) => (
                <li key={a.id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-display text-2xl text-ink">{a.player_name}</p>
                    <p className="mt-1 text-xs text-ink/55">{a.player_phone} · category <span className="capitalize">{a.skill_level}</span></p>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink/75">
                      <span className="chip-warn">{levelLabel(a.slot_level)}</span>
                      {formatDate(a.session_date)} · {formatTime(a.start_time)} · {a.venue_name}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => decide(a.id, "approve")} className="btn-volt btn-sm"><Check size={14} /> Approve</button>
                    <button type="button" onClick={() => decide(a.id, "decline")} className="btn-danger btn-sm">Decline</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "registrations" && <RegistrationsTab onChanged={load} onNotice={setNotice} />}

      {tab === "venues" && (
        <div>
          <ListState loading={loading} error={error} empty={venues.length === 0} emptyLabel="No venues yet." />
          {!loading && venues.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {venues.map((v) => (
                <li key={v.id} className="card flex items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{v.name}</p>
                    <p className="text-xs text-ink/55">{v.area ?? "—"} · {v.courts} court{v.courts === 1 ? "" : "s"}</p>
                    <span className={`mt-2 inline-block ${v.active ? "chip-volt" : "chip"}`}>{v.active ? "Listed" : "Hidden"}</span>
                  </div>
                  <button type="button" onClick={() => setEditingVenue(v)} className="btn-outline btn-sm"><Pencil size={13} /> Edit</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <RecordEditor
          title={`${formatDate(editing.session_date)} · ${formatTime(editing.start_time)}`}
          sub={`${editing.venue_name} · Court ${editing.court_number} · ${editing.booked}/${Math.min(MAX, editing.capacity)} booked${editing.waitlist ? ` · ${editing.waitlist} waiting` : ""}`}
          fields={SESSION_FIELDS}
          initial={{
            start_time: editing.start_time,
            end_time: editing.end_time,
            court_number: editing.court_number,
            capacity: Math.min(MAX, editing.capacity),
            level: editing.level,
            mixed_doubles: editing.mixed_doubles,
            pricing_mode: editing.pricing_mode ?? "fixed",
            price_rupees: editing.price_paise / 100,
            court_fee_rupees: (editing.court_fee_paise ?? 0) / 100,
            status: editing.status,
            notes: editing.notes ?? "",
          }}
          deleteLabel={editing.booked > 0 || editing.waitlist > 0 ? "Cancel slot" : "Delete slot"}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            const cap = Number(v.capacity);
            if (!Number.isFinite(cap) || cap < 1 || cap > MAX) return `Players must be between 1 and ${MAX}.`;
            const err = await submitResource("/api/admin/sessions", "PATCH", {
              id: editing.id,
              start_time: v.start_time,
              end_time: v.end_time,
              court_number: Number(v.court_number),
              capacity: cap,
              level: v.level,
              mixed_doubles: Boolean(v.mixed_doubles),
              pricing_mode: v.pricing_mode,
              price_paise: Math.round(Number(v.price_rupees || 0) * 100),
              court_fee_paise: Math.round(Number(v.court_fee_rupees || 0) * 100),
              status: v.status,
              notes: v.notes || null,
            });
            if (!err) await load();
            return err;
          }}
          onDelete={async () => {
            const err = await submitResource(`/api/admin/sessions?id=${editing.id}`, "DELETE");
            if (!err) await load();
            return err;
          }}
        />
      )}

      {roster && <RosterDrawer session={roster} onClose={() => setRoster(null)} onChanged={load} onNotice={setNotice} />}

      {editingVenue && (
        <RecordEditor
          title={editingVenue === "new" ? "New venue" : editingVenue.name}
          fields={VENUE_FIELDS}
          initial={editingVenue === "new" ? { courts: 2, sort_order: 0, active: true } : { name: editingVenue.name, area: editingVenue.area ?? "", address: editingVenue.address ?? "", courts: editingVenue.courts, maps_url: editingVenue.maps_url ?? "", sort_order: editingVenue.sort_order, active: editingVenue.active }}
          submitLabel={editingVenue === "new" ? "Add venue" : "Save venue"}
          onClose={() => setEditingVenue(null)}
          onSubmit={async (values) => {
            const err = editingVenue === "new" ? await submitResource("/api/admin/venues", "POST", values) : await submitResource("/api/admin/venues", "PATCH", { id: editingVenue.id, ...values });
            if (!err) await load();
            return err;
          }}
          onDelete={editingVenue === "new" ? undefined : async () => {
            const err = await submitResource(`/api/admin/venues?id=${editingVenue.id}`, "DELETE");
            if (!err) await load();
            return err;
          }}
          deleteLabel="Delete venue"
        />
      )}
    </div>
  );
}

/* ── Slot card ─────────────────────────────────────────────────────────── */

function SlotCard({ s, posting, onEdit, onRoster, onPost, onCourt }: { s: Session; posting: boolean; onEdit: () => void; onRoster: () => void; onPost: () => void; onCourt: (court: number) => void }) {
  const cap = Math.min(MAX, s.capacity);
  const full = s.booked >= cap;
  const closed = s.status !== "open";
  return (
    <li className={`card min-w-0 p-4 ${closed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight text-ink">{formatTime(s.start_time)} – {formatTime(s.end_time)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${levelChip(s.level)}`}>{levelLabel(s.level)}</span>
            {s.mixed_doubles && <span className="rounded-pill bg-fuchsia-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-fuchsia-900">Mixed doubles</span>}
            {closed && <span className="chip py-0 text-[10px]">{s.status}</span>}
          </div>
        </div>
        <label className="flex shrink-0 flex-col items-center">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">Court</span>
          <input
            type="number"
            min={1}
            max={50}
            defaultValue={s.court_number}
            aria-label="Court number"
            className="field-inline w-14 px-1 text-center font-display text-lg"
            onBlur={(e) => {
              const c = Number(e.target.value);
              if (Number.isInteger(c) && c >= 1 && c !== s.court_number) onCourt(c);
              else e.target.value = String(s.court_number);
            }}
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className={full ? "font-semibold text-signal" : "text-ink/70"}>{s.booked}/{cap} players{full ? " · full" : ""}</span>
          {s.waitlist > 0 && <span className="font-semibold text-amber-700">{s.waitlist} waiting</span>}
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {Array.from({ length: cap }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < s.booked ? (full ? "bg-signal" : "bg-volt") : "bg-mist"}`} />
          ))}
        </div>
        {s.mixed_doubles && (
          <p className="mt-1.5 text-[11px] text-ink/60">Men {s.male}/3 · Women {s.female}/3</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-ink/60">
          {formatPaise(perPlayerPaise(s))}/player
          {s.pricing_mode === "split" && <span className="block text-[10px] text-ink/45">{splitCaption(s)}</span>}
        </span>
        <div className="flex gap-1.5">
          <button type="button" onClick={onRoster} className="btn-outline btn-sm" title="Players and waitlist"><Users size={13} /> Players</button>
          <button type="button" onClick={onEdit} className="btn-outline btn-sm" aria-label="Edit slot"><Pencil size={13} /></button>
          <button type="button" onClick={onPost} disabled={posting || s.booked === 0} title={s.booked === 0 ? "Nobody booked yet" : "Post players and court to the group"} className="btn-outline btn-sm" aria-label="Post to WhatsApp group">
            {posting ? <Spinner size={13} /> : <MessageSquare size={13} />}
          </button>
        </div>
      </div>
    </li>
  );
}

/* ── Multi-venue planner ───────────────────────────────────────────────── */

type PlanRow = { key: number; venue_id: string; courts: number[]; times: Array<{ start: string; end: string }> };
const QUICK_TIMES = [["06:00", "07:00"], ["07:00", "08:00"], ["08:00", "09:00"], ["17:00", "18:00"], ["18:00", "19:00"], ["19:00", "20:00"], ["20:00", "21:00"], ["21:00", "22:00"]] as const;

function SlotPlanner({ venues, onDone }: { venues: Venue[]; onDone: (msg: string) => void }) {
  const calendar = upcomingDates(28);
  const [dates, setDates] = useState<string[]>(calendar.slice(0, 7));
  const [rows, setRows] = useState<PlanRow[]>(venues[0] ? [{ key: 1, venue_id: venues[0].id, courts: [1], times: [] }] : []);
  const [level, setLevel] = useState("all");
  const [mixed, setMixed] = useState(false);
  const [capacity, setCapacity] = useState(5);
  const [pricing, setPricing] = useState<"fixed" | "split">("fixed");
  const [price, setPrice] = useState(350);
  const [courtFee, setCourtFee] = useState(1400);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekday = (d: string) => new Date(d + "T00:00:00").getDay();
  const pickDates = (fn: (d: string) => boolean) => setDates(calendar.filter(fn));
  const update = (key: number, patch: Partial<PlanRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const total = dates.length * rows.reduce((n, r) => n + r.courts.length * r.times.length, 0);

  async function submit() {
    setError(null);
    if (dates.length === 0) return setError("Pick at least one date.");
    if (rows.length === 0) return setError("Add at least one venue.");
    for (const r of rows) {
      const v = venues.find((x) => x.id === r.venue_id);
      if (r.courts.length === 0) return setError(`Pick at least one court at ${v?.name ?? "each venue"}.`);
      if (r.times.length === 0) return setError(`Add at least one time at ${v?.name ?? "each venue"}.`);
      for (const t of r.times) if (!t.start || !t.end || t.end <= t.start) return setError(`At ${v?.name}: ${t.start || "?"}–${t.end || "?"} — the end must be after the start.`);
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dates,
          plan: rows.map((r) => ({ venue_id: r.venue_id, courts: r.courts, times: r.times })),
          level,
          mixed_doubles: mixed,
          capacity,
          pricing_mode: pricing,
          price_paise: Math.round(price * 100),
          court_fee_paise: Math.round(courtFee * 100),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create the slots.");
      onDone(data.message ?? `${data.created} slot${data.created === 1 ? "" : "s"} added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the slots.");
    } finally {
      setBusy(false);
    }
  }

  if (venues.length === 0) return <p className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink/55">Add a venue first (Venues tab).</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-5">
        {/* Dates */}
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-ink">1 · Dates <span className="font-normal text-ink/50">({dates.length} picked)</span></p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button type="button" className="chip" onClick={() => setDates(calendar.slice(0, 7))}>Next 7 days</button>
              <button type="button" className="chip" onClick={() => pickDates((d) => calendar.indexOf(d) < 14 && ![0, 6].includes(weekday(d)))}>Weekdays (2 wks)</button>
              <button type="button" className="chip" onClick={() => pickDates((d) => calendar.indexOf(d) < 14 && [0, 6].includes(weekday(d)))}>Weekends (2 wks)</button>
              <button type="button" className="chip" onClick={() => setDates([])}>Clear</button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {calendar.map((d) => {
              const on = dates.includes(d);
              const dt = new Date(d + "T00:00:00");
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDates((ds) => (on ? ds.filter((x) => x !== d) : [...ds, d].sort()))}
                  className={`rounded-lg border px-1 py-2 text-center text-xs transition-colors ${on ? "border-volt-deep bg-volt-soft font-semibold text-ink" : "border-line text-ink/65 hover:border-ink/30"}`}
                >
                  <span className="block font-mono text-[10px] uppercase">{dt.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                  {dt.getDate()} {dt.toLocaleDateString("en-IN", { month: "short" })}
                </button>
              );
            })}
          </div>
        </section>

        {/* Venues */}
        <section className="space-y-3">
          <p className="font-semibold text-ink">2 · Venues, courts &amp; times</p>
          {rows.map((r) => {
            const v = venues.find((x) => x.id === r.venue_id);
            const courtCount = Math.max(1, v?.courts ?? 1);
            return (
              <div key={r.key} className="card space-y-4 p-5">
                <div className="flex items-end gap-2">
                  <label className="flex-1">
                    <span className="label">Venue</span>
                    <select className="field" value={r.venue_id} onChange={(e) => update(r.key, { venue_id: e.target.value, courts: [1] })}>
                      {venues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove venue" className="mb-1 rounded-md p-2 text-ink/40 hover:bg-signal/10 hover:text-signal"><Trash2 size={16} /></button>
                </div>
                <div>
                  <span className="label">Courts</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: courtCount }, (_, i) => i + 1).map((c) => {
                      const on = r.courts.includes(c);
                      return (
                        <button key={c} type="button" aria-pressed={on} onClick={() => update(r.key, { courts: on ? r.courts.filter((x) => x !== c) : [...r.courts, c].sort((a, b) => a - b) })} className={`min-h-10 min-w-[3.25rem] rounded-pill border px-3 text-sm ${on ? "border-volt-deep bg-volt-soft font-semibold" : "border-line text-ink/70"}`}>
                          Court {c}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-ink/45">{v?.name} has {courtCount} court{courtCount === 1 ? "" : "s"} — change it under Venues.</p>
                </div>
                <div>
                  <span className="label">Times</span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TIMES.map(([a, b]) => {
                      const on = r.times.some((t) => t.start === a && t.end === b);
                      return (
                        <button key={a} type="button" aria-pressed={on} onClick={() => update(r.key, { times: on ? r.times.filter((t) => !(t.start === a && t.end === b)) : [...r.times, { start: a, end: b }].sort((x, y) => x.start.localeCompare(y.start)) })} className={`min-h-9 rounded-pill border px-3 text-xs ${on ? "border-volt-deep bg-volt-soft font-semibold" : "border-line text-ink/70"}`}>
                          {formatTime(a)}–{formatTime(b)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 space-y-2">
                    {r.times.filter((t) => !QUICK_TIMES.some(([a, b]) => a === t.start && b === t.end)).map((t, i) => (
                      <div key={`${t.start}-${i}`} className="flex items-center gap-2 text-sm">
                        <span className="text-ink/70">{formatTime(t.start)} – {formatTime(t.end)}</span>
                        <button type="button" onClick={() => update(r.key, { times: r.times.filter((x) => x !== t) })} aria-label="Remove time" className="text-ink/40 hover:text-signal"><X size={14} /></button>
                      </div>
                    ))}
                    <CustomTime onAdd={(t) => update(r.key, { times: [...r.times, t].sort((x, y) => x.start.localeCompare(y.start)) })} />
                  </div>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={() => setRows((rs) => [...rs, { key: Date.now(), venue_id: venues.find((v) => !rs.some((r) => r.venue_id === v.id))?.id ?? venues[0].id, courts: [1], times: [] }])} className="btn-outline btn-sm">
            <Plus size={14} /> Add another venue
          </button>
        </section>
      </div>

      {/* Settings + summary */}
      <aside className="card space-y-4 p-5 lg:sticky lg:top-6">
        <p className="font-semibold text-ink">3 · Tags &amp; price</p>
        <label className="block">
          <span className="label">Level tag</span>
          <select className="field" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVEL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" className="mt-1" checked={mixed} onChange={(e) => setMixed(e.target.checked)} />
          <span className="text-sm"><strong className="text-ink">Mixed doubles</strong><span className="block text-xs text-ink/55">Max 3 men or 3 women; the rest must be the other gender.</span></span>
        </label>
        <label className="block">
          <span className="label">Players per court (max 5)</span>
          <input type="number" min={1} max={5} className="field" value={capacity} onChange={(e) => setCapacity(Math.max(1, Math.min(5, Number(e.target.value) || 5)))} />
        </label>
        <label className="block">
          <span className="label">Pricing</span>
          <select className="field" value={pricing} onChange={(e) => setPricing(e.target.value as "fixed" | "split")}>
            <option value="fixed">Fixed price per player</option>
            <option value="split">Split the court fee</option>
          </select>
        </label>
        {pricing === "fixed" ? (
          <label className="block">
            <span className="label">Price per player (₹)</span>
            <input type="number" min={0} className="field" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </label>
        ) : (
          <label className="block">
            <span className="label">Court fee (₹)</span>
            <input type="number" min={0} className="field" value={courtFee} onChange={(e) => setCourtFee(Number(e.target.value))} />
            <span className="mt-1 block text-[11px] text-ink/50">≈ ₹{Math.ceil(courtFee / capacity)} per player</span>
          </label>
        )}
        <div className="rounded-xl bg-mist p-4 text-sm">
          <p className="font-display text-3xl text-ink">{total}</p>
          <p className="text-ink/60">slot{total === 1 ? "" : "s"} across {rows.length} venue{rows.length === 1 ? "" : "s"} and {dates.length} day{dates.length === 1 ? "" : "s"}. Existing slots are skipped.</p>
        </div>
        {error && <Alert>{error}</Alert>}
        <button type="button" onClick={submit} disabled={busy || total === 0} className="btn-primary w-full">
          {busy ? <Spinner /> : <CalendarPlus size={15} />} Create {total} slot{total === 1 ? "" : "s"}
        </button>
      </aside>
    </div>
  );
}

function CustomTime({ onAdd }: { onAdd: (t: { start: string; end: string }) => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label><span className="label">Custom start</span><input type="time" className="field-inline" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <label><span className="label">End</span><input type="time" className="field-inline" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      <button type="button" className="btn-outline btn-sm" disabled={!start || !end || end <= start} onClick={() => { onAdd({ start, end }); setStart(""); setEnd(""); }}>
        <Plus size={13} /> Add time
      </button>
    </div>
  );
}

/* ── Roster drawer ─────────────────────────────────────────────────────── */

function RosterDrawer({ session, onClose, onChanged, onNotice }: { session: Session; onClose: () => void; onChanged: () => void; onNotice: (m: string) => void }) {
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/registrations?session_id=${session.id}`);
    const data = await res.json().catch(() => ({}));
    setRows(data.registrations ?? []);
    setLoading(false);
  }, [session.id]);
  useEffect(() => void load(), [load]);

  const seated = rows.filter((r) => r.status === "confirmed" || r.status === "pending_approval");
  const waiting = rows.filter((r) => r.status === "waitlist");
  const other = rows.filter((r) => !seated.includes(r) && !waiting.includes(r));

  async function act(path: string, method: "PATCH" | "DELETE", body?: unknown) {
    const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (data.message) onNotice(data.message);
    await load();
    onChanged();
  }

  const Row = ({ r, n }: { r: Registration; n?: number }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{n != null && <span className="mr-1 font-mono text-xs text-amber-700">#{n}</span>}{r.player_name}{r.players_count > 1 ? ` +${r.players_count - 1}` : ""}</p>
        <p className="text-[11px] text-ink/55">{r.player_phone ?? "—"} · <span className="capitalize">{r.skill_level}</span>{r.gender ? ` · ${r.gender}` : ""} · {r.payment_status === "paid" ? "paid" : r.payment_method}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <select aria-label={`Status for ${r.player_name}`} className="field-inline text-xs" value={r.status} onChange={(e) => act("/api/admin/registrations", "PATCH", { id: r.id, status: e.target.value })}>
          <option value="confirmed">Confirmed</option>
          <option value="pending_approval">Awaiting approval</option>
          <option value="waitlist">Waitlist</option>
          <option value="cancelled">Cancelled</option>
          {r.status === "declined" && <option value="declined">Declined</option>}
        </select>
        <button type="button" aria-label={`Remove ${r.player_name}`} onClick={() => confirm(`Remove ${r.player_name} from this slot?`) && act(`/api/admin/registrations?id=${r.id}`, "DELETE")} className="rounded-md p-2 text-ink/40 hover:bg-signal/10 hover:text-signal"><Trash2 size={14} /></button>
      </div>
    </li>
  );

  return (
    <Drawer title={`${formatTime(session.start_time)} · ${session.venue_name}`} sub={`${formatDate(session.session_date)} · Court ${session.court_number}${session.mixed_doubles ? " · Mixed doubles" : ""}`} onClose={onClose}>
      {loading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          <section>
            <p className="font-semibold text-ink">On court · {seated.reduce((n, r) => n + r.players_count, 0)}/{Math.min(MAX, session.capacity)}</p>
            {seated.length === 0 ? <p className="mt-2 text-sm text-ink/50">Nobody yet.</p> : <ul className="divide-y divide-line">{seated.map((r) => <Row key={r.id} r={r} />)}</ul>}
          </section>
          <section>
            <p className="font-semibold text-ink">Waitlist · {waiting.length}</p>
            <p className="text-xs text-ink/50">Promoted automatically, in order, when a seat frees up.</p>
            {waiting.length === 0 ? <p className="mt-2 text-sm text-ink/50">Empty.</p> : <ul className="divide-y divide-line">{waiting.map((r, i) => <Row key={r.id} r={r} n={i + 1} />)}</ul>}
          </section>
          {other.length > 0 && (
            <section>
              <p className="font-semibold text-ink/60">Cancelled / declined</p>
              <ul className="divide-y divide-line opacity-70">{other.map((r) => <Row key={r.id} r={r} />)}</ul>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

/* ── Registrations by date ─────────────────────────────────────────────── */

function RegistrationsTab({ onChanged, onNotice }: { onChanged: () => void; onNotice: (m: string) => void }) {
  const [date, setDate] = useState(istToday());
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/registrations?date=${date}`);
    const data = await res.json().catch(() => ({}));
    setRows(data.registrations ?? []);
    setLoading(false);
  }, [date]);
  useEffect(() => void load(), [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch("/api/admin/registrations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    const data = await res.json().catch(() => ({}));
    if (data.message) onNotice(data.message);
    load();
    onChanged();
  }

  const statusChip = (s: string) => (s === "confirmed" ? "chip-volt" : s === "waitlist" ? "chip-warn" : "chip");

  return (
    <div>
      <label className="mb-4 flex flex-wrap items-center gap-3">
        <span className="label mb-0">Date</span>
        <input type="date" className="field-inline max-w-[200px]" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {loading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink/50">Nobody booked for this date yet.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.player_name}{r.players_count > 1 ? ` +${r.players_count - 1}` : ""}</p>
                  <p className="text-[11px] text-ink/55">{r.player_phone ?? "—"} · <span className="capitalize">{r.skill_level}</span>{r.gender ? ` · ${r.gender}` : ""}</p>
                  <p className="mt-1 text-xs text-ink/70">{formatTime(r.start_time)} · {r.venue_name} · Court {r.court_number ?? r.session_court}{r.mixed_doubles ? " · Mixed" : ""}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={statusChip(r.status)}>{r.status === "pending_approval" ? "awaiting approval" : r.status}</span>
                  <span className={r.payment_status === "paid" ? "chip-volt" : "chip"}>{r.payment_status === "paid" ? "paid" : r.payment_method}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <select aria-label="Status" className="field-inline text-xs" value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })}>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending_approval">Awaiting approval</option>
                  <option value="waitlist">Waitlist</option>
                  <option value="cancelled">Cancelled</option>
                  {r.status === "declined" && <option value="declined">Declined</option>}
                </select>
                <select aria-label="Payment" className="field-inline text-xs" value={r.payment_status} onChange={(e) => patch(r.id, { payment_status: e.target.value })}>
                  <option value="pending">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                  {r.payment_status === "failed" && <option value="failed">Failed</option>}
                </select>
                <label className="flex items-center gap-1 text-xs text-ink/60">
                  Court
                  <input type="number" min={1} max={50} defaultValue={r.court_number ?? r.session_court} className="field-inline w-14 px-1 text-center" onBlur={(e) => { const c = Number(e.target.value); if (c && c !== (r.court_number ?? r.session_court)) patch(r.id, { court_number: c }); }} />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
