"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  List,
  Mail,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import { Avatar } from "@/components/player-directory";
import { Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/dates";
import { LEVEL_LABEL } from "@/lib/levels";
import type { CoachBooking, ClientProfile } from "@/lib/coach-data";

// ── Date helpers ─────────────────────────────────────────────────────────────
// Everything is a "YYYY-MM-DD" string handled in UTC arithmetic, so a coach in
// any timezone sees a booking on the day it was booked for, never a day off.

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
/** Today in Kolkata, where every session happens. */
function todayIST(): string {
  const now = new Date(Date.now() + 5.5 * 3600_000);
  return iso(now);
}
/** The Monday on or before the 1st of the month, and 42 days from there. */
function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(iso(first), -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS: Record<CoachBooking["status"], { label: string; chip: string; dot: string }> = {
  requested: { label: "Requested", chip: "bg-amber/10 text-amber border-amber/30", dot: "bg-amber" },
  confirmed: { label: "Confirmed", chip: "bg-volt-soft text-volt-deep border-volt-deep/30", dot: "bg-volt-deep" },
  completed: { label: "Completed", chip: "bg-mist text-ink/60 border-line", dot: "bg-ink/40" },
  cancelled: { label: "Cancelled", chip: "bg-signal/5 text-signal/80 border-signal/20 line-through", dot: "bg-signal/60" },
};

const SESSION_LABEL: Record<string, string> = { single: "1-on-1", pair: "Pair", group: "Group" };

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function CoachCalendar() {
  const today = todayIST();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CoachBooking | null>(null);

  // A phone gets the agenda by default: seven columns of 50px squares cannot
  // hold a name and a time, and a list can.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("agenda");
  }, []);

  const days = useMemo(() => monthGrid(year, month), [year, month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/bookings?from=${days[0]}&to=${days[days.length - 1]}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load your bookings.");
      setBookings(data.bookings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your bookings.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, CoachBooking[]>();
    for (const b of bookings) {
      if (!b.preferred_date) continue;
      const list = m.get(b.preferred_date) ?? [];
      list.push(b);
      m.set(b.preferred_date, list);
    }
    return m;
  }, [bookings]);

  const undated = bookings.filter((b) => !b.preferred_date);
  const monthKey = `${year}-${pad(month + 1)}`;
  const inMonth = bookings
    .filter((b) => b.preferred_date?.startsWith(monthKey))
    .sort((a, b) => `${a.preferred_date}${a.preferred_time ?? ""}`.localeCompare(`${b.preferred_date}${b.preferred_time ?? ""}`));

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  }
  function goToday() {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)) - 1);
    setSelectedDay(today);
  }

  const selected = byDay.get(selectedDay) ?? [];

  return (
    <section aria-labelledby="cal-title">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)} className="btn-outline btn-sm px-2.5" aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <h2 id="cal-title" className="min-w-[10.5rem] text-center font-display text-2xl text-ink">
            {MONTHS[month]} {year}
          </h2>
          <button type="button" onClick={() => shift(1)} className="btn-outline btn-sm px-2.5" aria-label="Next month">
            <ChevronRight size={16} />
          </button>
          <button type="button" onClick={goToday} className="btn btn-sm ml-1 bg-mist text-ink hover:bg-white">
            Today
          </button>
          {loading && <Spinner />}
        </div>

        <div className="flex rounded-pill border border-line p-0.5" role="group" aria-label="Calendar view">
          {(
            [
              ["month", CalendarDays, "Month"],
              ["agenda", List, "Agenda"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                view === key ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1" aria-label="Status key">
        {(Object.keys(STATUS) as Array<CoachBooking["status"]>).map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-[11px] text-ink/60">
            <span className={`h-2 w-2 rounded-full ${STATUS[k].dot}`} /> {STATUS[k].label}
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-4 rounded-lg border border-signal/30 bg-signal/5 px-4 py-3 text-sm text-signal">{error}</p>
      )}

      {view === "month" ? (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Month grid */}
          <div className="overflow-hidden rounded-card border border-line bg-paper">
            <div className="grid grid-cols-7 border-b border-line bg-mist/60">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const list = byDay.get(day) ?? [];
                const outside = !day.startsWith(monthKey);
                const isToday = day === today;
                const isSelected = day === selectedDay;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    aria-label={`${formatDate(day)}: ${list.length} booking${list.length === 1 ? "" : "s"}`}
                    aria-pressed={isSelected}
                    className={`group relative flex min-h-[6.5rem] flex-col gap-1 border-line p-1.5 text-left transition-colors ${
                      i % 7 !== 6 ? "border-r" : ""
                    } ${i < 35 ? "border-b" : ""} ${outside ? "bg-mist/30" : "bg-paper hover:bg-mist/40"} ${
                      isSelected ? "ring-2 ring-inset ring-volt-deep" : ""
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] ${
                        isToday ? "bg-ink font-semibold text-paper" : outside ? "text-ink/30" : "text-ink/70"
                      }`}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {list.slice(0, 3).map((b) => (
                      <span
                        key={b.id}
                        className={`truncate rounded border px-1.5 py-0.5 text-[10.5px] font-medium ${STATUS[b.status].chip}`}
                      >
                        {b.preferred_time ? `${formatTime(b.preferred_time)} ` : ""}
                        {first(b.player_name)}
                      </span>
                    ))}
                    {list.length > 3 && <span className="px-1 text-[10px] text-ink/50">+{list.length - 3} more</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* The selected day */}
          <aside className="card h-fit p-5" aria-live="polite">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
              {selectedDay === today ? "Today" : "Selected day"}
            </p>
            <h3 className="mt-1 font-display text-xl text-ink">{formatDate(selectedDay)}</h3>
            {selected.length === 0 ? (
              <p className="mt-4 text-sm text-ink/50">No sessions booked.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {selected.map((b) => (
                  <li key={b.id}>
                    <BookingRow booking={b} onOpen={setOpen} />
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : (
        /* Agenda: this month's sessions as a list, grouped by day */
        <div className="mt-5">
          {inMonth.length === 0 && !loading ? (
            <p className="rounded-card border border-dashed border-line px-5 py-10 text-center text-sm text-ink/55">
              No dated sessions in {MONTHS[month]}.
            </p>
          ) : (
            <ol className="space-y-5">
              {Array.from(new Set(inMonth.map((b) => b.preferred_date as string))).map((day) => (
                <li key={day}>
                  <h3
                    className={`mb-2 font-mono text-[11px] uppercase tracking-[0.12em] ${
                      day === today ? "text-volt-deep" : "text-ink/50"
                    }`}
                  >
                    {day === today ? "Today · " : ""}
                    {formatDate(day)}
                  </h3>
                  <ul className="space-y-2">
                    {inMonth
                      .filter((b) => b.preferred_date === day)
                      .map((b) => (
                        <li key={b.id}>
                          <BookingRow booking={b} onOpen={setOpen} />
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Requests without a date */}
      {undated.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-xl text-ink">Needs a date</h3>
          <p className="mt-1 text-sm text-ink/55">
            These players asked for coaching without picking a day. The club will fix a time with them.
          </p>
          {/* grid-cols-1 is minmax(0,1fr): an implicit column sized to the
              longest no-wrap line pushed the page wider than a phone. */}
          <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {undated.map((b) => (
              <li key={b.id} className="min-w-0">
                <BookingRow booking={b} onOpen={setOpen} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && <BookingDrawer booking={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function BookingRow({ booking: b, onOpen }: { booking: CoachBooking; onOpen: (b: CoachBooking) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(b)}
      data-booking-row
      className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-line bg-paper p-3 text-left transition-colors hover:border-ink/30"
    >
      <Avatar name={b.player_name} src={b.avatar_url} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{b.player_name}</span>
        <span className="block truncate font-mono text-[10.5px] uppercase tracking-wide text-ink/45">
          {b.preferred_time ? formatTime(b.preferred_time) : "Time to fix"} · {SESSION_LABEL[b.session_type] ?? b.session_type}
          {b.sessions_count > 1 ? ` × ${b.sessions_count}` : ""} · {LEVEL_LABEL[b.skill_level] ?? b.skill_level}
        </span>
      </span>
      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS[b.status].chip}`}>
        {STATUS[b.status].label}
      </span>
    </button>
  );
}

/**
 * The booking and the player behind it. The profile comes from a separate call
 * that the server only answers for this coach's own clients.
 */
function BookingDrawer({ booking: b, onClose }: { booking: CoachBooking; onClose: () => void }) {
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(b.user_id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    if (!b.user_id) return;
    let live = true;
    fetch(`/api/coach/clients/${b.user_id}`)
      .then((r) => r.json())
      .then((d) => live && setClient(d.client ?? null))
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [b.user_id]);

  const phone = b.player_phone.replace(/\D/g, "");
  const wa = phone.length === 10 ? `91${phone}` : phone;

  // Portalled to <body>: the page content sits in its own stacking context
  // (z-index 1, above the backdrop), so a fixed drawer rendered in place could
  // never rise above the site header or footer, whatever its own z-index.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={`Booking ${b.booking_no}`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-paper shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="font-mono text-[11px] text-volt-deep">{b.booking_no}</p>
            <p className="font-display text-lg text-ink">
              {b.preferred_date ? formatDate(b.preferred_date) : "Date to be fixed"}
              {b.preferred_time ? ` · ${formatTime(b.preferred_time)}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-ink/50 hover:bg-mist hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {/* The session */}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Item label="Status">
              <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold ${STATUS[b.status].chip}`}>
                {STATUS[b.status].label}
              </span>
            </Item>
            <Item label="Format">
              {SESSION_LABEL[b.session_type] ?? b.session_type}
              {b.sessions_count > 1 ? ` × ${b.sessions_count} sessions` : ""}
            </Item>
            <Item label="Fee">{formatPaise(b.amount_paise)}</Item>
            <Item label="Payment">
              <span className="capitalize">{b.payment_status}</span>
              <span className="text-ink/45"> · {b.payment_method === "razorpay" ? "online" : b.payment_method}</span>
            </Item>
          </dl>
          {b.notes && (
            <div className="rounded-lg border border-line bg-mist/40 p-3 text-sm text-ink/75">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">Note from the player</p>
              <p className="mt-1">{b.notes}</p>
            </div>
          )}

          {/* The player */}
          <section className="border-t border-line pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">Player</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={client?.full_name ?? b.player_name} src={client?.avatar_url ?? b.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{client?.full_name ?? b.player_name}</p>
                <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink/45">
                  {LEVEL_LABEL[client?.skill_level ?? b.skill_level] ?? b.skill_level}
                  {(client?.dupr ?? b.dupr) != null && ` · DUPR ${Number(client?.dupr ?? b.dupr).toFixed(2)}`}
                </p>
              </div>
              {(client?.handle ?? b.handle) && (
                <Link href={`/players/${client?.handle ?? b.handle}`} target="_blank" className="btn-outline btn-sm shrink-0 px-2.5" title="Public player page">
                  <ExternalLink size={14} />
                </Link>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${b.player_phone}`} className="btn-outline btn-sm">
                <Phone size={14} /> Call
              </a>
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
                  <MessageCircle size={14} /> WhatsApp
                </a>
              )}
              {(b.player_email ?? client?.email) && (
                <a href={`mailto:${b.player_email ?? client?.email}`} className="btn-outline btn-sm">
                  <Mail size={14} /> Email
                </a>
              )}
            </div>
            <p className="mt-2 font-mono text-[11px] text-ink/50">
              {b.player_phone}
              {(b.player_email ?? client?.email) ? ` · ${b.player_email ?? client?.email}` : ""}
            </p>

            {loading ? (
              <div className="mt-5 flex items-center gap-2 text-sm text-ink/50">
                <Spinner /> Loading their profile…
              </div>
            ) : client ? (
              <div className="mt-5 space-y-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Item label="Games played">{client.games_played}</Item>
                  <Item label="Member since">{formatDate(client.created_at.slice(0, 10))}</Item>
                  {client.city && <Item label="City">{client.city}</Item>}
                  {client.dupr_id && <Item label="DUPR ID">{client.dupr_id}</Item>}
                </dl>
                {client.bio && <p className="text-sm leading-relaxed text-ink/70">{client.bio}</p>}

                {client.assessment && (
                  <div className="rounded-lg border border-line p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">Latest self-assessment</p>
                    <p className="mt-1 text-sm text-ink">
                      Suggested {LEVEL_LABEL[client.assessment.suggested_level] ?? client.assessment.suggested_level}
                      <span className="text-ink/45"> · score {client.assessment.score} · {formatDate(client.assessment.created_at.slice(0, 10))}</span>
                    </p>
                    {client.assessment.goal && <p className="mt-1 text-sm text-ink/65">Goal: {client.assessment.goal}</p>}
                    {client.assessment.coach_notes && (
                      <p className="mt-1 text-sm text-ink/65">Coach notes: {client.assessment.coach_notes}</p>
                    )}
                  </div>
                )}

                {client.history.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                      Sessions with you ({client.history.length})
                    </p>
                    <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                      {client.history.map((h) => (
                        <li key={h.booking_no} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="text-ink/75">
                            {h.preferred_date ? formatDate(h.preferred_date) : "Undated"}
                            {h.preferred_time ? ` · ${formatTime(h.preferred_time)}` : ""}
                          </span>
                          <span className="text-[11px] capitalize text-ink/50">{h.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm text-ink/50">
                {b.user_id ? "Their profile is not available." : "Booked without an account — contact details only."}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
