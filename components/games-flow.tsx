"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Banknote, CalendarDays, CalendarX, Check, CreditCard, MapPin, MessageCircle, Users, Wallet } from "lucide-react";
import { openRazorpay } from "@/components/razorpay-client";
import { Alert, Spinner, Stepper } from "@/components/ui";
import { Confetti } from "@/components/motion";
import { MiniPlayerModal } from "@/components/mini-player-modal";
import { formatDate, formatTime, formatTimeRange, isPast } from "@/lib/dates";
import { formatPaise, perPlayerPaise, splitCaption } from "@/lib/money";
import { LEVEL_LABEL, approvalReason, needsApproval } from "@/lib/levels";
import { WHATSAPP_GROUP_URL, waLink } from "@/lib/site";
import type { GameSession, RosterPlayer } from "@/lib/types";

const STEPS = ["Pick slots", "Checkout", "Confirmed"];

type Confirmation = {
  reference: string;
  total_paise: number;
  payment_method: string;
  bookings: Array<{
    session_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    level?: string;
    status: string;
  }>;
  pending_approval?: Array<{ date: string; time: string; level: string }>;
};

export type BookingPlayer = {
  name: string;
  phone: string;
  email: string;
  skill: string;
  dupr?: number | null;
  dupr_id?: string | null;
};

/**
 * Slot booking for a signed-in player.
 *
 * There is no guest details step: the account already holds the name, number
 * and rating, so the flow starts at the thing the player came to do. Venue is
 * chosen before date because that is the order the decision is made in.
 */
export function GamesFlow({
  sessions,
  razorpayEnabled,
  razorpayKeyId,
  walletPaise = 0,
  player,
}: {
  sessions: GameSession[];
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  walletPaise?: number;
  player: BookingPlayer;
}) {
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [pay, setPay] = useState<"razorpay" | "venue" | "wallet">(razorpayEnabled ? "razorpay" : "venue");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [activeVenue, setActiveVenue] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);

  // Venue first: a player decides where before when.
  const venues = useMemo(() => {
    const map = new Map<string, { id: string; name: string; area?: string | null; open: number }>();
    for (const s of sessions) {
      const entry = map.get(s.venue_id) ?? {
        id: s.venue_id,
        name: s.venue_name ?? "Venue",
        area: s.venue_area,
        open: 0,
      };
      if (s.capacity - (s.booked ?? 0) > 0 && !isPast(s.session_date, s.start_time)) entry.open += 1;
      map.set(s.venue_id, entry);
    }
    return [...map.values()];
  }, [sessions]);

  const shownVenue = activeVenue && venues.some((v) => v.id === activeVenue) ? activeVenue : venues[0]?.id;
  const currentVenue = useMemo(() => venues.find((v) => v.id === shownVenue), [venues, shownVenue]);
  const venueSessions = useMemo(() => sessions.filter((s) => s.venue_id === shownVenue), [sessions, shownVenue]);

  const byDate = useMemo(() => {
    const map = new Map<string, GameSession[]>();
    for (const s of venueSessions) {
      if (!map.has(s.session_date)) map.set(s.session_date, []);
      map.get(s.session_date)!.push(s);
    }
    return map;
  }, [venueSessions]);

  // Calendar dates: generate upcoming 21 days from today + any session dates
  const calendarDates = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    for (let i = 0; i < 21; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      list.push(`${y}-${m}-${day}`);
    }
    for (const s of venueSessions) {
      if (s.session_date && !list.includes(s.session_date)) {
        list.push(s.session_date);
      }
    }
    return list.sort();
  }, [venueSessions]);

  // Pick default date: first date with available slots, or today (calendarDates[0])
  const firstDateWithSlots = useMemo(
    () => calendarDates.find((d) => (byDate.get(d) ?? []).length > 0),
    [calendarDates, byDate]
  );
  const shownDate = activeDate && calendarDates.includes(activeDate)
    ? activeDate
    : (firstDateWithSlots || calendarDates[0] || "");
  const daySessions = shownDate ? (byDate.get(shownDate) ?? []) : [];

  // Next available date with slots for quick jump when looking ahead at empty dates
  const nextDateWithSlots = useMemo(() => {
    if (!shownDate) return null;
    return (
      calendarDates.find((d) => d > shownDate && (byDate.get(d) ?? []).length > 0) ||
      calendarDates.find((d) => d !== shownDate && (byDate.get(d) ?? []).length > 0) ||
      null
    );
  }, [calendarDates, shownDate, byDate]);

  const pickedSessions = useMemo(() => sessions.filter((s) => picked.includes(s.id)), [sessions, picked]);
  const totalPaise = pickedSessions.reduce((sum, s) => sum + perPlayerPaise(s), 0);
  const gatedPicks = pickedSessions.filter((s) => needsApproval(s.level, player.skill));

  const spotsLeft = (s: GameSession) => s.capacity - (s.booked ?? 0);

  function toggle(session: GameSession) {
    if (spotsLeft(session) < 1) return;
    setPicked((prev) =>
      prev.includes(session.id) ? prev.filter((id) => id !== session.id) : [...prev, session.id],
    );
  }

  function next() {
    setError(null);
    if (picked.length === 0) return setError("Pick at least one slot to continue.");
    setStep(2);
  }

  async function confirmBooking() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/games/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player_name: player.name,
          player_phone: player.phone,
          player_email: player.email,
          skill_level: player.skill,
          session_ids: picked,
          players_count: 1,
          payment_method: pay,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not complete the booking.");

      if (!data.razorpay_order_id) {
        setConfirmation(data);
        setStep(3);
        setBusy(false);
        return;
      }

      const opened = await openRazorpay({
        keyId: razorpayKeyId,
        orderId: data.razorpay_order_id,
        amountPaise: data.total_paise,
        name: "SuperPro Daily Games",
        description: `${picked.length} slot${picked.length > 1 ? "s" : ""}`,
        prefill: { name: player.name, email: player.email, contact: player.phone },
        notes: { reference: data.reference },
        onSuccess: async (payload) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "game", reference: data.reference, ...payload }),
          });
          const verified = await verify.json();
          if (verify.ok) {
            setConfirmation({ ...data, ...verified, payment_method: "razorpay" });
            setStep(3);
          } else {
            setError("Payment could not be verified. Your slot is held — message a rep with your reference.");
          }
          setBusy(false);
        },
        onDismiss: () => setBusy(false),
      });

      if (!opened) {
        setError("Payment window could not open. Switch to pay-at-venue, or message a rep.");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  function reset() {
    setPicked([]);
    setNotes("");
    setConfirmation(null);
    setError(null);
    setStep(1);
  }

  return (
    <div>
      <Stepper steps={STEPS} current={step} />

      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div key={step} className="step-in">
        {/* ── Step 1 — venue, date, slots ───────────────────────────────── */}
        {step === 1 && (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="card min-w-0 p-6">
              <h2 className="text-2xl">This week&apos;s slots</h2>
              <p className="mt-1.5 text-sm text-ink/65">Choose a venue, then tap the slots you want.</p>

              {venues.length > 1 && (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {venues.map((v) => {
                    const on = v.id === shownVenue;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setActiveVenue(v.id);
                          setActiveDate(null);
                        }}
                        className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                          on ? "border-ink bg-volt-soft shadow-card" : "border-line hover:border-ink/40"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-display text-lg text-ink">{v.name}</span>
                          {on && <Check size={15} className="shrink-0 text-volt-deep" />}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink/55">
                          {v.area ? `${v.area} · ` : ""}
                          {v.open} open
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Calendar Date Adjustment Bar */}
              <div className="scroll-x mt-6 flex gap-2 pb-2 no-scrollbar">
                {calendarDates.map((d) => {
                  const sessionList = byDate.get(d) ?? [];
                  const open = sessionList.filter(
                    (s) => spotsLeft(s) > 0 && !isPast(s.session_date, s.start_time),
                  ).length;
                  const hasSlots = sessionList.length > 0;
                  const isActive = d === shownDate;
                  const dateParts = formatDate(d).split(", ");
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setActiveDate(d)}
                      className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                        isActive
                          ? "border-ink bg-volt-soft shadow-xs"
                          : "border-line hover:border-line-strong bg-paper"
                      }`}
                    >
                      <span
                        className={`block font-mono text-[10px] uppercase tracking-[0.14em] ${
                          isActive ? "text-volt-deep font-bold" : "text-ink/55"
                        }`}
                      >
                        {dateParts[0]}
                      </span>
                      <span className={`block font-display text-base ${isActive ? "text-ink font-bold" : "text-ink/75"}`}>
                        {dateParts[1] ?? d}
                      </span>
                      {hasSlots ? (
                        <span
                          className={`mt-0.5 block text-[10px] ${
                            open > 0 ? "font-semibold text-volt-deep" : "text-amber"
                          }`}
                        >
                          {open > 0 ? `${open} open` : "Full"}
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-[10px] text-ink/35">No slots</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Slot Cards or Empty Date State */}
              {daySessions.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-mist/20 p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-volt/20 text-volt-deep">
                    <CalendarX size={24} />
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold text-ink">
                    No slots posted for {shownDate ? formatDate(shownDate) : "this date"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-ink/65">
                    Admin has not published any slot schedules for this date at {currentVenue?.name ?? "this venue"} yet.
                    Daily game slots are released in rolling schedules throughout the week.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={waLink(
                        `Hi SuperPro! Are there any daily game slots opening up for ${shownDate ? formatDate(shownDate) : "upcoming dates"} at ${currentVenue?.name ?? "the venue"}?`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-volt btn-sm inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <MessageCircle size={14} /> Request Slot on WhatsApp
                    </a>

                    {nextDateWithSlots && (
                      <button
                        type="button"
                        onClick={() => setActiveDate(nextDateWithSlots)}
                        className="btn-outline btn-sm inline-flex items-center gap-1.5 text-xs"
                      >
                        <CalendarDays size={14} /> Jump to next open slots ({formatDate(nextDateWithSlots).split(",")[0]})
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div key={shownDate} className="stagger mt-5 grid gap-3 sm:grid-cols-2">
                  {daySessions.map((s) => {
                    const left = spotsLeft(s);
                    const past = isPast(s.session_date, s.start_time);
                    const disabled = past || left < 1;
                    const selected = picked.includes(s.id);
                    const gated = needsApproval(s.level, player.skill);
                    const roster = s.roster ?? [];
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => !disabled && toggle(s)}
                        disabled={disabled}
                        className={`tile text-left ${selected ? "tile-selected" : ""} ${disabled ? "tile-disabled" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-display text-2xl text-ink">{formatTime(s.start_time)}</span>
                          {selected ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-volt text-ink">
                              <Check size={12} />
                            </span>
                          ) : (
                            <span
                              className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                                left <= 2 ? "text-amber font-semibold" : "text-volt-deep font-semibold"
                              }`}
                            >
                              {past ? "Started" : left <= 0 ? "Full" : `${left} left`}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-ink/65">{formatTimeRange(s.start_time, s.end_time)}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/70">
                          <MapPin size={11} /> {s.venue_name}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between">
                          <span className={gated ? "chip-warn py-0.5 text-[10px]" : "chip py-0.5 text-[10px]"}>
                            {LEVEL_LABEL[s.level] ?? s.level}
                          </span>
                          <span className="text-right">
                            <span className="block text-sm font-semibold text-volt-deep">
                              {formatPaise(perPlayerPaise(s))}
                            </span>
                            {splitCaption(s) && (
                              <span className="block text-[10px] text-ink/45">{splitCaption(s)}</span>
                            )}
                          </span>
                        </div>

                        {roster.length > 0 && (
                          <div className="mt-3 border-t border-line/80 pt-2.5 text-left">
                            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/50">
                              Already coming ({roster.reduce((acc, r) => acc + 1 + (r.guests || 0), 0)}) · Tap name to view profile
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {roster.map((r, i) => (
                                <span
                                  key={r.user_id || `${r.name}-${i}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPlayer(r);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.stopPropagation();
                                      setSelectedPlayer(r);
                                    }
                                  }}
                                  className="group/player inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium text-ink transition-all hover:border-volt hover:bg-volt-soft cursor-pointer"
                                  title={`View ${r.name}'s profile`}
                                >
                                  {r.avatar_url ? (
                                    <img
                                      src={r.avatar_url}
                                      alt=""
                                      className="h-3.5 w-3.5 rounded-full object-cover shrink-0"
                                    />
                                  ) : (
                                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-ink/10 text-[8px] font-bold text-ink shrink-0">
                                      {r.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                  <span className="truncate max-w-[95px]">{r.name}</span>
                                  {(r.guests ?? 0) > 0 && (
                                    <span className="text-ink/40 text-[10px]">+{r.guests}</span>
                                  )}
                                  {r.dupr != null && (
                                    <span className="font-mono text-[9px] font-semibold text-volt-deep bg-mist px-1 rounded">
                                      {Number(r.dupr).toFixed(1)}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {gated && (
                          <p className="mt-2 text-[10px] leading-snug text-amber">
                            {approvalReason(s.level, player.skill)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              <div className="card p-6">
                <h3 className="text-xl">Your picks</h3>
                <p className="mt-1 text-xs text-ink/50">Booking as {player.name}</p>

                {pickedSessions.length === 0 ? (
                  <p className="mt-4 text-sm text-ink/55">Nothing picked yet.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {pickedSessions.map((s) => (
                      <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
                        <span>
                          <span className="block text-ink">
                            {formatDate(s.session_date)} · {formatTime(s.start_time)}
                          </span>
                          <span className="block text-xs text-ink/55">{s.venue_name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => toggle(s)}
                          className="text-xs text-ink/40 hover:text-signal"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-sm text-ink/60">
                    {picked.length} slot{picked.length === 1 ? "" : "s"}
                  </span>
                  <span className="font-display text-2xl text-volt-deep">{formatPaise(totalPaise)}</span>
                </div>

                <button type="button" onClick={next} disabled={picked.length === 0} className="btn-volt mt-5 w-full">
                  Continue to checkout <ArrowRight size={16} />
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ── Step 2 — checkout ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="card max-w-2xl p-7">
            <h2 className="text-2xl">Checkout</h2>

            <dl className="mt-5 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/60">Player</dt>
                <dd className="text-ink">{player.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">WhatsApp</dt>
                <dd className="tabular-nums text-ink">+91 {player.phone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">DUPR Profile</dt>
                <dd className="font-mono text-ink">
                  {player.dupr != null ? `DUPR ${Number(player.dupr).toFixed(2)}` : "Unrated"}
                  {player.dupr_id ? ` · ${player.dupr_id}` : ""}
                </dd>
              </div>
            </dl>

            <ul className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
              {pickedSessions.map((s) => (
                <li key={s.id} className="flex justify-between gap-4">
                  <span className="text-ink/70">
                    {formatDate(s.session_date)} · {formatTime(s.start_time)} · {s.venue_name}
                  </span>
                  <span className="tabular-nums text-ink/80">{formatPaise(perPlayerPaise(s))}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4 border-t border-line pt-3">
                <span className="font-display text-xl text-ink">Total</span>
                <span className="font-display text-xl tabular-nums text-volt-deep">{formatPaise(totalPaise)}</span>
              </li>
            </ul>

            {gatedPicks.length > 0 && (
              <div className="mt-5">
                <Alert tone="info">
                  {gatedPicks.length === 1 ? "One of these courts is" : `${gatedPicks.length} of these courts are`}{" "}
                  above your band, so an admin approves before you appear on the roster.
                </Alert>
              </div>
            )}

            <div className="mt-6">
              <span className="label">Payment</span>
              <div className="grid gap-3 sm:grid-cols-2">
                {walletPaise > 0 && (
                  <button
                    type="button"
                    onClick={() => setPay("wallet")}
                    disabled={walletPaise < totalPaise}
                    className={`tile ${pay === "wallet" ? "tile-selected" : ""} ${
                      walletPaise < totalPaise ? "opacity-40" : ""
                    }`}
                  >
                    <Wallet size={18} className="text-volt-deep" />
                    <p className="mt-2 font-display text-lg uppercase text-ink">SuperPro wallet</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {walletPaise < totalPaise
                        ? `Only ${formatPaise(walletPaise)} left — top up first.`
                        : `${formatPaise(walletPaise)} available.`}
                    </p>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => razorpayEnabled && setPay("razorpay")}
                  disabled={!razorpayEnabled}
                  className={`tile ${pay === "razorpay" ? "tile-selected" : ""} ${!razorpayEnabled ? "opacity-40" : ""}`}
                >
                  <CreditCard size={18} className="text-volt-deep" />
                  <p className="mt-2 font-display text-lg uppercase text-ink">Pay online</p>
                  <p className="mt-1 text-xs text-ink/55">
                    {razorpayEnabled ? "UPI or card. Confirms instantly." : "Temporarily unavailable."}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setPay("venue")}
                  className={`tile ${pay === "venue" ? "tile-selected" : ""}`}
                >
                  <Banknote size={18} className="text-volt-deep" />
                  <p className="mt-2 font-display text-lg uppercase text-ink">Pay at venue</p>
                  <p className="mt-1 text-xs text-ink/55">Held for 20 minutes from slot start.</p>
                </button>
              </div>
            </div>

            <div className="mt-5">
              <label className="label" htmlFor="g-notes">
                Notes for the organiser (optional)
              </label>
              <textarea
                id="g-notes"
                rows={2}
                className="field resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Running five minutes late, need a spare paddle…"
              />
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-outline">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="button" onClick={confirmBooking} disabled={busy} className="btn-volt">
                {busy ? <Spinner /> : null}
                {busy
                  ? "Confirming…"
                  : pay === "razorpay"
                    ? `Pay ${formatPaise(totalPaise)}`
                    : pay === "wallet"
                      ? `Pay ${formatPaise(totalPaise)} from wallet`
                      : "Confirm booking"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 — confirmed ────────────────────────────────────────── */}
        {step === 3 && confirmation && (
          <div className="card relative max-w-2xl overflow-hidden p-8 text-center">
            <Confetti trigger={1} />
            <div className="mx-auto flex h-16 w-16 animate-score-pop items-center justify-center rounded-full bg-volt text-ink">
              <Check size={30} strokeWidth={3} />
            </div>
            <h2 className="headline-section mt-5">
              {confirmation.payment_method === "razorpay" || confirmation.payment_method === "wallet"
                ? "Paid & confirmed"
                : "Slot confirmed"}
            </h2>
            <p className="mt-3 text-sm text-ink/60">
              Reference <span className="font-semibold text-volt-deep">{confirmation.reference}</span>.
              {confirmation.payment_method === "venue"
                ? " Pay at the venue — your spot is held for 20 minutes from the start time."
                : " See you on court."}
            </p>

            <ul className="mt-7 space-y-3 border-t border-line pt-6 text-left">
              {confirmation.bookings.map((b, i) => {
                const waiting = b.status === "pending_approval";
                return (
                  <li
                    key={i}
                    className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 ${
                      waiting ? "border border-amber/30 bg-amber/5" : "bg-mist"
                    }`}
                  >
                    <span>
                      <span className="block font-display text-xl text-ink">
                        {formatDate(b.session_date)} · {formatTime(b.start_time)}
                      </span>
                      <span className="block text-xs text-ink/65">{b.venue_name}</span>
                      {waiting && (
                        <span className="mt-1 block text-[11px] text-amber">
                          Awaiting admin approval — this court is above your band.
                        </span>
                      )}
                    </span>
                    <span className={waiting ? "chip-warn shrink-0" : "chip-volt shrink-0"}>
                      {waiting ? "Pending" : "Confirmed"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 rounded-xl border border-line bg-mist p-4 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Users size={15} className="text-volt-deep" /> Posted to the games group
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink/65">
                Your name goes into the SuperPro daily-games WhatsApp group and onto the slot on this site, so
                everyone knows who they&apos;re playing with. Courts are assigned on the day.
              </p>
              {WHATSAPP_GROUP_URL && (
                <a
                  href={WHATSAPP_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary btn-sm mt-3"
                >
                  <MessageCircle size={14} /> Open the group
                </a>
              )}
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={reset} className="btn-volt">
                Book another slot
              </button>
              <Link href="/dashboard" className="btn-outline">
                My bookings
              </Link>
            </div>
          </div>
        )}
      </div>

      {selectedPlayer && (
        <MiniPlayerModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
