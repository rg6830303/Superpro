"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, MapPin, MessageSquare, Pencil, Trash2, Users } from "lucide-react";
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
import { formatPaise, perPlayerPaise, splitCaption } from "@/lib/money";

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
  pricing_mode: string;
  court_fee_paise: number;
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

const TIME_SLOT_FIELDS: FieldDef[] = [
  { name: "start_time", label: "Start", type: "time", required: true },
  { name: "end_time", label: "End", type: "time", required: true },
  { name: "label", label: "Label", full: true, placeholder: "Prime evening" },
  { name: "sort_order", label: "Sort order", type: "number" },
  { name: "active", label: "Offer this slot", type: "checkbox" },
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
  {
    name: "pricing_mode",
    label: "Pricing",
    type: "select",
    options: [
      { value: "fixed", label: "Fixed price per player" },
      { value: "split", label: "Split the court fee" },
    ],
  },
  { name: "price_paise", label: "Price per player (paise)", type: "number", hint: "35000 = ₹350 · used when pricing is fixed" },
  {
    name: "court_fee_paise",
    label: "Court fee per hour (paise)",
    type: "number",
    hint: "140000 = ₹1,400 · split evenly across capacity",
  },
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

type TimeSlot = {
  id: string;
  label: string | null;
  start_time: string;
  end_time: string;
  sort_order: number;
  active: boolean;
};

type Tab = "slots" | "times" | "venues" | "registrations";

export default function AdminGamesPage() {
  const [tab, setTab] = useState<Tab>("slots");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [posting, setPosting] = useState<string | null>(null);

  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [creatingVenue, setCreatingVenue] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingTime, setEditingTime] = useState<TimeSlot | null>(null);
  const [creatingTime, setCreatingTime] = useState(false);
  const [regDate, setRegDate] = useState(istToday());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, v, t] = await Promise.all([
        fetch("/api/admin/sessions").then((r) => r.json()),
        fetch("/api/admin/venues").then((r) => r.json()),
        fetch("/api/admin/time-slots").then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      if (v.error) throw new Error(v.error);
      setSessions(s.sessions ?? []);
      setVenues(v.venues ?? []);
      setTimeSlots(t.slots ?? []);
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
        <StatTile label="Open spots (2 weeks)" value={openSpots} tone="accent" />
        <StatTile label="Active venues" value={venues.filter((v) => v.active).length} />
      </div>

      {notice && (
        <div className="mb-5">
          <Alert tone="ok">{notice}</Alert>
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {(["slots", "times", "venues", "registrations"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-volt text-ink" : "border border-line text-ink/70 hover:text-ink"
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
                {date === today && <span className="chip-volt ml-3 py-0 text-[10px]">Today</span>}
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
                      <th>Per player</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id}>
                        <td className="whitespace-nowrap font-semibold text-ink">
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </td>
                        <td>{s.venue_name}</td>
                        <td>{s.court_number}</td>
                        <td className="capitalize">{s.level}</td>
                        <td>
                          <span className={s.booked >= s.capacity ? "text-signal" : "text-ink"}>
                            {s.booked}/{s.capacity}
                          </span>
                        </td>
                        <td>
                          <span className="block tabular-nums text-ink">{formatPaise(perPlayerPaise(s))}</span>
                          {s.pricing_mode === "split" && (
                            <span className="block text-[11px] text-ink/45">{splitCaption(s)}</span>
                          )}
                        </td>
                        <td>
                          <span className={s.status === "open" ? "chip-volt" : "chip"}>{s.status}</span>
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

      {/* ── Time slots ────────────────────────────────────────────────────
          The reusable library the daily schedule is composed from, so a slot
          means the same thing at every venue. ──────────────────────────── */}
      {tab === "times" && !loading && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-ink/60">
              Define a slot once and reuse it across venues and days.
            </p>
            <AddButton label="Add time slot" onClick={() => setCreatingTime(true)} />
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Label</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {timeSlots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink/45">
                      No time slots yet.
                    </td>
                  </tr>
                ) : (
                  timeSlots.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap font-mono tabular-nums text-ink">
                        {formatTime(t.start_time)} – {formatTime(t.end_time)}
                      </td>
                      <td>{t.label ?? "—"}</td>
                      <td>{t.sort_order}</td>
                      <td>
                        <span className={t.active ? "chip-volt" : "chip"}>{t.active ? "Active" : "Retired"}</span>
                      </td>
                      <td>
                        <button type="button" onClick={() => setEditingTime(t)} className="btn-outline btn-sm">
                          <Pencil size={13} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                  <td colSpan={5} className="py-8 text-center text-ink/55">
                    No venues yet.
                  </td>
                </tr>
              ) : (
                venues.map((v) => (
                  <tr key={v.id}>
                    <td className="font-semibold text-ink">{v.name}</td>
                    <td>{v.area ?? "—"}</td>
                    <td>{v.courts}</td>
                    <td>
                      <span className={v.active ? "chip-volt" : "chip"}>{v.active ? "Active" : "Hidden"}</span>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink/55">
                      Nobody booked for this date yet.
                    </td>
                  </tr>
                ) : (
                  registrations.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold text-ink">{r.player_name}</td>
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
                        <span className={r.payment_status === "paid" ? "chip-volt" : "chip-warn"}>
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
                      <td>
                        <button
                          type="button"
                          aria-label={`Remove ${r.player_name}`}
                          title="Remove from this slot"
                          onClick={async () => {
                            await submitResource(`/api/admin/registrations?id=${r.id}`, "DELETE");
                            loadRegistrations(regDate);
                          }}
                          className="rounded-md p-2 text-ink/40 transition-colors hover:bg-signal/10 hover:text-signal"
                        >
                          <Trash2 size={14} />
                        </button>
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
      {bulkOpen && (
        <BulkSlotEditor venues={venues} timeSlots={timeSlots} onClose={() => setBulkOpen(false)} onDone={load} />
      )}

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
            pricing_mode: editingSession.pricing_mode ?? "fixed",
            price_paise: editingSession.price_paise,
            court_fee_paise: editingSession.court_fee_paise ?? 0,
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

      {(creatingTime || editingTime) && (
        <RecordEditor
          title={editingTime ? "Edit time slot" : "New time slot"}
          sub="Used by the game builder; existing games keep the times they were created with."
          fields={TIME_SLOT_FIELDS}
          initial={
            editingTime
              ? {
                  label: editingTime.label ?? "",
                  start_time: editingTime.start_time,
                  end_time: editingTime.end_time,
                  sort_order: editingTime.sort_order,
                  active: editingTime.active,
                }
              : { start_time: "18:00", end_time: "19:00", sort_order: timeSlots.length + 1, active: true }
          }
          submitLabel={editingTime ? "Save slot" : "Add slot"}
          onClose={() => {
            setCreatingTime(false);
            setEditingTime(null);
          }}
          onSubmit={async (values) => {
            const err = editingTime
              ? await submitResource("/api/admin/time-slots", "PATCH", { id: editingTime.id, ...values })
              : await submitResource("/api/admin/time-slots", "POST", values);
            if (!err) await load();
            return err;
          }}
          onDelete={
            editingTime
              ? async () => {
                  const err = await submitResource(`/api/admin/time-slots?id=${editingTime.id}`, "DELETE");
                  if (!err) await load();
                  return err;
                }
              : undefined
          }
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
          onDelete={
            editingVenue
              ? async () => {
                  const err = await submitResource(`/api/admin/venues?id=${editingVenue.id}`, "DELETE");
                  if (!err) await load();
                  return err;
                }
              : undefined
          }
          deleteLabel="Delete venue"
        />
      )}
    </div>
  );
}

/**
 * Bulk slot builder — the usual case is "these times, these courts, every day
 * this week", which would be dozens of single-row creates otherwise.
 */
/**
 * Builds a week of games in one pass: pick the venues, the dates, the slots
 * from the reusable library, and how many courts each slot runs on. The unique
 * key on game_sessions is (venue, date, start, court), so the same time slot
 * can run at every venue on the same day, and re-running this is safe —
 * duplicates are skipped rather than doubled.
 */
function BulkSlotEditor({
  venues,
  timeSlots,
  onClose,
  onDone,
}: {
  venues: Venue[];
  timeSlots: TimeSlot[];
  onClose: () => void;
  onDone: () => void;
}) {
  const dates = upcomingDates(14);
  const [venueIds, setVenueIds] = useState<string[]>(venues[0] ? [venues[0].id] : []);
  const [selectedDates, setSelectedDates] = useState<string[]>(dates.slice(0, 7));
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [courts, setCourts] = useState(2);
  const [level, setLevel] = useState("all");
  const [capacity, setCapacity] = useState(8);
  const [pricingMode, setPricingMode] = useState<"fixed" | "split">("fixed");
  const [priceRupees, setPriceRupees] = useState(350);
  const [courtFeeRupees, setCourtFeeRupees] = useState(1400);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = selectedDates.length * slotIds.length * courts * venueIds.length;
  const perPlayer = pricingMode === "split" ? Math.ceil(courtFeeRupees / Math.max(1, capacity)) : priceRupees;

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  async function submit() {
    if (venueIds.length === 0) return setError("Pick at least one venue.");
    if (selectedDates.length === 0) return setError("Pick at least one date.");
    if (slotIds.length === 0) return setError("Pick at least one time slot.");
    setBusy(true);
    setError(null);
    const err = await submitResource("/api/admin/sessions", "POST", {
      venue_ids: venueIds,
      dates: selectedDates,
      time_slot_ids: slotIds,
      courts,
      level,
      capacity,
      pricing_mode: pricingMode,
      price_paise: Math.round(priceRupees * 100),
      court_fee_paise: Math.round(courtFeeRupees * 100),
    });
    setBusy(false);
    if (err) return setError(err);
    onDone();
    onClose();
  }

  return (
    <RecordEditorShell
      title="Add games"
      sub={`${total} slot${total === 1 ? "" : "s"} · ${perPlayer} per player`}
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      submitLabel="Create games"
      error={error}
    >
      <div className="space-y-6">
        <div>
          <span className="label">Venues</span>
          <div className="flex flex-wrap gap-2">
            {venues.map((v) => {
              const on = venueIds.includes(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVenueIds((prev) => toggle(prev, v.id))}
                  className={`rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                    on ? "border-ink bg-volt-soft text-ink" : "border-line text-ink/60 hover:border-ink/40"
                  }`}
                >
                  {v.name}
                  {v.area ? ` \u00b7 ${v.area}` : ""}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-ink/45">
            The same slot can run at several venues on the same day — pick as many as you need.
          </p>
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
                  onClick={() => setSelectedDates((prev) => toggle(prev, d))}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    on ? "border-ink bg-volt-soft text-ink" : "border-line text-ink/55 hover:border-ink/40"
                  }`}
                >
                  {formatDate(d)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="label">Time slots</span>
          {timeSlots.filter((t) => t.active).length === 0 ? (
            <p className="text-sm text-ink/55">
              No slots defined yet — add them under the <strong>Times</strong> tab first.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {timeSlots
                .filter((t) => t.active)
                .map((t) => {
                  const on = slotIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSlotIds((prev) => toggle(prev, t.id))}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        on ? "border-ink bg-volt-soft" : "border-line hover:border-ink/40"
                      }`}
                    >
                      <span className="block font-mono text-sm tabular-nums text-ink">
                        {formatTime(t.start_time)} – {formatTime(t.end_time)}
                      </span>
                      {t.label && <span className="block text-[11px] text-ink/50">{t.label}</span>}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bulk-courts">Courts per slot</label>
            <input
              id="bulk-courts"
              type="number"
              min={1}
              max={12}
              className="field"
              value={courts}
              onChange={(e) => setCourts(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="bulk-cap">Players per court</label>
            <input
              id="bulk-cap"
              type="number"
              min={2}
              max={24}
              className="field"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="bulk-level">Level</label>
            <select id="bulk-level" className="field" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label">How players are charged</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPricingMode("fixed")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                pricingMode === "fixed" ? "border-ink bg-volt-soft" : "border-line hover:border-ink/40"
              }`}
            >
              <span className="block text-sm font-semibold text-ink">Fixed per player</span>
              <span className="block text-[11px] text-ink/55">Everyone pays the same set amount.</span>
            </button>
            <button
              type="button"
              onClick={() => setPricingMode("split")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                pricingMode === "split" ? "border-ink bg-volt-soft" : "border-line hover:border-ink/40"
              }`}
            >
              <span className="block text-sm font-semibold text-ink">Split the court fee</span>
              <span className="block text-[11px] text-ink/55">Hourly court cost divided by players.</span>
            </button>
          </div>

          <div className="mt-4">
            {pricingMode === "fixed" ? (
              <div>
                <label className="label" htmlFor="bulk-price">Price per player (INR)</label>
                <input
                  id="bulk-price"
                  type="number"
                  min={0}
                  className="field"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(Number(e.target.value))}
                />
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="bulk-fee">Court fee per hour (INR)</label>
                <input
                  id="bulk-fee"
                  type="number"
                  min={0}
                  className="field"
                  value={courtFeeRupees}
                  onChange={(e) => setCourtFeeRupees(Number(e.target.value))}
                />
                <p className="mt-2 rounded-lg bg-mist px-3 py-2 font-mono text-[12px] tabular-nums text-ink/70">
                  {courtFeeRupees} / {capacity} players = <strong className="text-ink">{perPlayer}</strong> each
                </p>
                <p className="mt-1.5 text-[11px] text-ink/45">
                  Divided by capacity rather than by who has booked so far, so the price a player was shown
                  never changes behind them.
                </p>
              </div>
            )}
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
      <div className="flex h-full w-full max-w-lg flex-col border-l border-line bg-paper">
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div>
            <h2 className="text-3xl">{title}</h2>
            {sub && <p className="mt-1 text-xs text-ink/55">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-ink/70 hover:bg-mist">
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
        <div className="flex items-center justify-between gap-3 border-t border-line p-6">
          <span className="flex items-center gap-1.5 text-xs text-ink/45">
            <Users size={12} /> Duplicates are skipped automatically
          </span>
          <button type="button" onClick={onSubmit} disabled={busy} className="btn-volt">
            {busy ? <Spinner /> : null} {busy ? "Creating…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
