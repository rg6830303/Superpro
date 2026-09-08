"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, MapPin, MessageSquare, Pencil, Users } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import {
  AddButton,
  ListState,
  RecordEditor,
  submitResource,
  type FieldDef,
} from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";
import { formatDate, formatTime, istToday, upcomingDates } from "@/lib/dates";
import { formatPaise } from "@/lib/money";

type Venue = {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  courts: number;
  maps_url: string | null;
  active: boolean;
  sort_order: number;
};

type Session = {
  id: string;
  venue_id: string;
  venue_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  court_number: number;
  level: string;
  capacity: number;
  price_paise: number;
  status: string;
  booked: number;
  whatsapp_posted_at: string | null;
};

type Registration = {
  id: string;
  session_id: string;
  player_name: string;
  player_phone: string;
  skill_level: string;
  players_count: number;
  court_number: number | null;
  session_court: number;
  amount_paise: number;
  payment_method: string;
  payment_status: string;
  status: string;
  session_date: string;
  start_time: string;
  venue_name: string;
};

const LEVELS = [
  { value: "all", label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const VENUE_FIELDS: FieldDef[] = [
  { name: "name", label: "Venue name", required: true },
  { name: "area", label: "Area", placeholder: "New Alipore" },
  { name: "address", label: "Address", type: "textarea" },
  { name: "courts", label: "Courts", type: "number" },
  { name: "maps_url", label: "Google Maps link", full: true },
  { name: "sort_order", label: "Sort order", type: "number" },
  { name: "active", label: "Listed on the site", type: "checkbox" },
];

const SESSION_EDIT_FIELDS: FieldDef[] = [
  { name: "start_time", label: "Start time", type: "time", required: true },
  { name: "end_time", label: "End time", type: "time", required: true },
  { name: "court_number", label: "Court number", type: "number" },
  { name: "capacity", label: "Capacity", type: "number" },
  { name: "level", label: "Level", type: "select", options: LEVELS },
  { name: "price_paise", label: "Price (paise)", type: "number", hint: "35000 = ₹350" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
  { name: "notes", label: "Notes", type: "textarea" },
];

type Tab = "slots" | "venues" | "registrations";

export default function AdminGamesPage() {
  const [tab, setTab] = useState<Tab>("slots");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [posting, setPosting] = useState<string | null>(null);

  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [creatingVenue, setCreatingVenue] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [regDate, setRegDate] = useState(istToday());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, v] = await Promise.all([
        fetch("/api/admin/sessions").then((r) => r.json()),
        fetch("/api/admin/venues").then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      if (v.error) throw new Error(v.error);
      setSessions(s.sessions ?? []);
      setVenues(v.venues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRegistrations = useCallback(async (date: string) => {
    const res = await fetch(`/api/admin/registrations?date=${date}`);
    const data = await res.json();
    if (res.ok) setRegistrations(data.registrations ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "registrations") loadRegistrations(regDate);
  }, [tab, regDate, loadRegistrations]);

  const today = istToday();
  const todaySlots = sessions.filter((s) => s.session_date === today);
  const openSpots = sessions.reduce((n, s) => n + Math.max(0, s.capacity - (s.booked ?? 0)), 0);

  const byDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!map.has(s.session_date)) map.set(s.session_date, []);
      map.get(s.session_date)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  async function postToGroup(sessionId: string) {
    setPosting(sessionId);
    setNotice(null);
    const res = await fetch("/api/admin/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "post_slot", session_id: sessionId }),
    });
    const data = await res.json();
    setPosting(null);
    setNotice(
      data.ok
        ? "Posted to the games group."
        : "Queued — open Admin → WhatsApp to send it with one tap.",
    );
    load();
  }

  return (
    <div>
      <AdminHeader
        title="Daily games"
        sub="Slots, venues and who is on court."
        action={
          <div className="flex gap-2">
            <AddButton label="Add slots" onClick={() => setBulkOpen(true)} />
            <button type="button" onClick={() => setCreatingVenue(true)} className="btn-outline btn-sm">
              <MapPin size={13} /> Add venue
            </button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Slots today" value={todaySlots.length} />
        <StatTile label="Open spots (2 weeks)" value={openSpots} tone="gold" />
        <StatTile label="Active venues" value={venues.filter((v) => v.active).length} />
      </div>

      {notice && (
        <div className="mb-5">
          <Alert tone="ok">{notice}</Alert>
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {(["slots", "venues", "registrations"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-gold text-ink" : "border border-white/15 text-bone/60 hover:text-bone"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <ListState
        loading={loading}
        error={error}
        empty={tab === "slots" && sessions.length === 0}
        emptyLabel="No slots scheduled. Use “Add slots” to build the week."
      />

      {/* ── Slots ─────────────────────────────────────────────────────── */}
      {tab === "slots" && !loading && sessions.length > 0 && (
        <div className="space-y-6">
          {byDate.map(([date, list]) => (
            <div key={date}>
              <h3 className="mb-3 text-xl">
                {formatDate(date)}
                {date === today && <span className="chip-gold ml-3 py-0 text-[10px]">Today</span>}
              </h3>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Venue</th>
                      <th>Court</th>
                      <th>Level</th>
                      <th>Booked</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id}>
                        <td className="whitespace-nowrap font-semibold text-bone">
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </td>
                        <td>{s.venue_name}</td>
                        <td>{s.court_number}</td>
                        <td className="capitalize">{s.level}</td>
                        <td>
                          <span className={s.booked >= s.capacity ? "text-danger" : "text-bone"}>
                            {s.booked}/{s.capacity}
                          </span>
                        </td>
                        <td>{formatPaise(s.price_paise)}</td>
                        <td>
                          <span className={s.status === "open" ? "chip-live" : "chip"}>{s.status}</span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setEditingSession(s)} className="btn-outline btn-sm">
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => postToGroup(s.id)}
                              disabled={posting === s.id || s.booked === 0}
                              title={s.booked === 0 ? "Nobody booked yet" : "Post players and court to the group"}
                              className="btn-outline btn-sm"
                            >
                              {posting === s.id ? <Spinner size={13} /> : <MessageSquare size={13} />}
                              {s.whatsapp_posted_at ? "Re-post" : "Post"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Venues ────────────────────────────────────────────────────── */}
      {tab === "venues" && !loading && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Venue</th>
                <th>Area</th>
                <th>Courts</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {venues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-bone/45">
                    No venues yet.
                  </td>
                </tr>
              ) : (
                venues.map((v) => (
                  <tr key={v.id}>
                    <td className="font-semibold text-bone">{v.name}</td>
                    <td>{v.area ?? "—"}</td>
                    <td>{v.courts}</td>
                    <td>
                      <span className={v.active ? "chip-live" : "chip"}>{v.active ? "Active" : "Hidden"}</span>
                    </td>
                    <td>
                      <button type="button" onClick={() => setEditingVenue(v)} className="btn-outline btn-sm">
                        <Pencil size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Registrations ─────────────────────────────────────────────── */}
      {tab === "registrations" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="label mb-0" htmlFor="reg-date">
              Date
            </label>
            <input
              id="reg-date"
              type="date"
              className="field max-w-[200px]"
              value={regDate}
              onChange={(e) => setRegDate(e.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Phone</th>
                  <th>Slot</th>
                  <th>Court</th>
                  <th>Players</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-bone/45">
                      Nobody booked for this date yet.
                    </td>
                  </tr>
                ) : (
                  registrations.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold text-bone">{r.player_name}</td>
                      <td className="text-xs">{r.player_phone}</td>
                      <td className="whitespace-nowrap text-xs">
                        {formatTime(r.start_time)} · {r.venue_name}
                      </td>
                      <td>
                        <input
                          type="number"
                          defaultValue={r.court_number ?? r.session_court}
                          min={1}
                          max={20}
                          aria-label={`Court for ${r.player_name}`}
                          className="field w-16 px-2 py-1 text-center text-sm"
                          onBlur={async (e) => {
                            const court = Number(e.target.value);
                            if (!court || court === (r.court_number ?? r.session_court)) return;
                            await submitResource("/api/admin/registrations", "PATCH", { id: r.id, court_number: court });
                            loadRegistrations(regDate);
                          }}
                        />
                      </td>
                      <td>{r.players_count}</td>
                      <td>
                        <span className={r.payment_status === "paid" ? "chip-live" : "chip-gold"}>
                          {r.payment_status === "paid" ? "Paid" : r.payment_method}
                        </span>
                      </td>
                      <td>
                        <select
                          defaultValue={r.status}
                          aria-label={`Status for ${r.player_name}`}
                          className="field px-2 py-1 text-sm"
                          onChange={async (e) => {
                            await submitResource("/api/admin/registrations", "PATCH", {
                              id: r.id,
                              status: e.target.value,
                            });
                            loadRegistrations(regDate);
                          }}
                        >
                          <option value="confirmed">Confirmed</option>
                          <option value="waitlist">Waitlist</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Editors ───────────────────────────────────────────────────── */}
      {bulkOpen && <BulkSlotEditor venues={venues} onClose={() => setBulkOpen(false)} onDone={load} />}

      {editingSession && (
        <RecordEditor
          title={`${formatDate(editingSession.session_date)} · ${formatTime(editingSession.start_time)}`}
          sub={`${editingSession.venue_name} · ${editingSession.booked} booked`}
          fields={SESSION_EDIT_FIELDS}
          initial={{
            start_time: editingSession.start_time,
            end_time: editingSession.end_time,
            court_number: editingSession.court_number,
            capacity: editingSession.capacity,
            level: editingSession.level,
            price_paise: editingSession.price_paise,
            status: editingSession.status,
            notes: "",
          }}
          deleteLabel={editingSession.booked > 0 ? "Cancel slot" : "Delete slot"}
          onClose={() => setEditingSession(null)}
          onSubmit={async (values) => {
            const err = await submitResource("/api/admin/sessions", "PATCH", { id: editingSession.id, ...values });
            if (!err) await load();
            return err;
          }}
          onDelete={async () => {
            const err = await submitResource(`/api/admin/sessions?id=${editingSession.id}`, "DELETE");
            if (!err) await load();
            return err;
          }}
        />
      )}

      {(creatingVenue || editingVenue) && (
        <RecordEditor
          title={editingVenue ? editingVenue.name : "New venue"}
          fields={VENUE_FIELDS}
          initial={
            editingVenue
              ? {
                  name: editingVenue.name,
                  area: editingVenue.area ?? "",
                  address: editingVenue.address ?? "",
                  courts: editingVenue.courts,
                  maps_url: editingVenue.maps_url ?? "",
                  sort_order: editingVenue.sort_order,
                  active: editingVenue.active,
                }
              : { courts: 2, sort_order: 0, active: true }
          }
          submitLabel={editingVenue ? "Save venue" : "Add venue"}
          onClose={() => {
            setCreatingVenue(false);
            setEditingVenue(null);
          }}
          onSubmit={async (values) => {
            const err = editingVenue
              ? await submitResource("/api/admin/venues", "PATCH", { id: editingVenue.id, ...values })
              : await submitResource("/api/admin/venues", "POST", values);
            if (!err) await load();
            return err;
          }}
        />
      )}
    </div>
  );
}

/**
 * Bulk slot builder — the usual case is "these times, these courts, every day
 * this week", which would be dozens of single-row creates otherwise.
 */
function BulkSlotEditor({
  venues,
  onClose,
  onDone,
}: {
  venues: Venue[];
  onClose: () => void;
  onDone: () => void;
}) {
  const dates = upcomingDates(14);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [selectedDates, setSelectedDates] = useState<string[]>(dates.slice(0, 7));
  const [times, setTimes] = useState([{ start: "06:30", end: "07:30" }]);
  const [courts, setCourts] = useState(2);
  const [level, setLevel] = useState("all");
  const [capacity, setCapacity] = useState(8);
  const [priceRupees, setPriceRupees] = useState(350);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = selectedDates.length * times.length * courts;

  async function submit() {
    if (!venueId) return setError("Pick a venue first.");
    if (selectedDates.length === 0) return setError("Pick at least one date.");
    setBusy(true);
    setError(null);
    const err = await submitResource("/api/admin/sessions", "POST", {
      venue_id: venueId,
      dates: selectedDates,
      times,
      courts,
      level,
      capacity,
      price_paise: Math.round(priceRupees * 100),
    });
    setBusy(false);
    if (err) return setError(err);
    onDone();
    onClose();
  }

  return (
    <RecordEditorShell
      title="Add slots"
      sub={`${total} slot${total === 1 ? "" : "s"} will be created (duplicates are skipped)`}
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      submitLabel="Create slots"
      error={error}
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="bulk-venue">Venue</label>
          <select id="bulk-venue" className="field" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.area ? ` — ${v.area}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">Dates</span>
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => {
              const on = selectedDates.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setSelectedDates((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    on ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-bone/50"
                  }`}
                >
                  {formatDate(d)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="label">Times</span>
          <div className="space-y-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  className="field"
                  value={t.start}
                  aria-label={`Start time ${i + 1}`}
                  onChange={(e) =>
                    setTimes((prev) => prev.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))
                  }
                />
                <span className="text-bone/30">→</span>
                <input
                  type="time"
                  className="field"
                  value={t.end}
                  aria-label={`End time ${i + 1}`}
                  onChange={(e) =>
                    setTimes((prev) => prev.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))
                  }
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTimes((prev) => prev.filter((_, j) => j !== i))}
                    className="btn-ghost btn-sm"
                    aria-label={`Remove time ${i + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTimes((prev) => [...prev, { start: "18:00", end: "19:00" }])}
            className="btn-outline btn-sm mt-2"
          >
            <CalendarPlus size={13} /> Add another time
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bulk-courts">Courts per slot</label>
            <input id="bulk-courts" type="number" min={1} max={12} className="field" value={courts} onChange={(e) => setCourts(Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="bulk-cap">Capacity per court</label>
            <input id="bulk-cap" type="number" min={2} max={24} className="field" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="bulk-level">Level</label>
            <select id="bulk-level" className="field" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bulk-price">Price per player (₹)</label>
            <input id="bulk-price" type="number" min={0} className="field" value={priceRupees} onChange={(e) => setPriceRupees(Number(e.target.value))} />
          </div>
        </div>
      </div>
    </RecordEditorShell>
  );
}

/** Drawer with a custom body — used where a plain field list is not enough. */
function RecordEditorShell({
  title,
  sub,
  children,
  onClose,
  onSubmit,
  submitLabel,
  busy,
  error,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-ink-900">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <h2 className="text-3xl">{title}</h2>
            {sub && <p className="mt-1 text-xs text-bone/45">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-bone/60 hover:bg-white/5">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-5">
              <Alert>{error}</Alert>
            </div>
          )}
          {children}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 p-6">
          <span className="flex items-center gap-1.5 text-xs text-bone/35">
            <Users size={12} /> Duplicates are skipped automatically
          </span>
          <button type="button" onClick={onSubmit} disabled={busy} className="btn-gold">
            {busy ? <Spinner /> : null} {busy ? "Creating…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
