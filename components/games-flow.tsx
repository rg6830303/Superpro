"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Banknote, CalendarDays, CalendarX, Check, CreditCard, MapPin, MessageCircle, Users, Wallet } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { openRazorpay } from "@/components/razorpay-client";
import { Alert, Spinner, Stepper } from "@/components/ui";
import { Confetti } from "@/components/motion";
import { MiniPlayerModal } from "@/components/mini-player-modal";
import { formatDate, formatTime, formatTimeRange, isPast } from "@/lib/dates";
import { WALLET_FLOOR_PAISE, duesPaise } from "@/lib/postpaid";
import { formatPaise, perPlayerPaise, splitCaption } from "@/lib/money";
import { LEVEL_LABEL, approvalReason, needsApproval } from "@/lib/levels";
import { WHATSAPP_GROUP_URL, waLink } from "@/lib/site";
import type { GameSession, RosterPlayer } from "@/lib/types";

const STEPS = ["Pick slots", "Checkout"];

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
  const router = useRouter();
  const { addSlots } = useCart();
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

  /**
   * Hand the picked slots to the single basket.
   *
   * Each slot is one seat, keyed by its session id, so re-adding a slot the
   * player already has is a no-op rather than a second ticket.
   */
  function addPicksToCart() {
    addSlots(
      pickedSessions.map((s) => ({
        product_id: s.id,
        slug: "",
        name: `${s.venue_name} · ${formatDate(s.session_date)} ${formatTime(s.start_time)}`,
        price_paise: perPlayerPaise(s),
        image_url: null,
        kind: "slot" as const,
        session_id: s.id,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        venue_name: s.venue_name,
        level: s.level,
      })),
    );
    router.push("/cart");
  }
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
                <>
                {(() => {
                  // One line above the grid, because the useful question on
                  // arrival is "where are my people playing today", not "which
                  // courts exist". Silent when nobody you follow is booked.
                  const withFriends = daySessions.filter((d) => (d.following_count ?? 0) > 0);
                  if (withFriends.length === 0) return null;
                  const people = new Map<string, string>();
                  for (const d of withFriends)
                    for (const r of d.roster ?? [])
                      if (r.you_follow && !r.is_you) people.set(r.user_id ?? r.name, r.name.split(" ")[0]);
                  const names = [...people.values()];
                  return (
                    <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-volt/40 bg-volt-soft px-4 py-3">
                      <Users size={15} className="mt-0.5 shrink-0 text-volt-deep" />
                      <p className="text-[13px] leading-relaxed text-ink">
                        <strong className="font-semibold">
                          {names.length === 1
                            ? `${names[0]} is`
                            : names.length === 2
                              ? `${names[0]} and ${names[1]} are`
                              : `${names.slice(0, 2).join(", ")} and ${names.length - 2} others you follow are`}
                        </strong>{" "}
                        playing {withFriends.length === 1 ? "a slot" : `${withFriends.length} slots`} on this date.{" "}
                        <span className="text-ink/65">Their courts are listed first.</span>
                      </p>
                    </div>
                  );
                })()}
                <div key={shownDate} className="stagger mt-5 grid gap-3 sm:grid-cols-2">
                  {[...daySessions]
                    .sort((a, b) => {
                      // A notification saying a friend booked a court is only
                      // useful if that court is then easy to find. Slots with
                      // people you follow lead the day; everything else keeps
                      // its normal chronological order.
                      const diff = (b.following_count ?? 0) - (a.following_count ?? 0);
                      return diff !== 0 ? diff : 0;
                    })
                    .map((s) => {
                    const left = spotsLeft(s);
                    const past = isPast(s.session_date, s.start_time);
                    const disabled = past || left < 1;
                    const selected = picked.includes(s.id);
                    const gated = needsApproval(s.level, player.skill);
                    const roster = s.roster ?? [];
                    // Roster already arrives with followed players first.
                    const friends = roster.filter((r) => r.you_follow && !r.is_you);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => !disabled && toggle(s)}
                        disabled={disabled}
                        className={`tile text-left ${selected ? "tile-selected" : ""} ${disabled ? "tile-disabled" : ""}`}
                      >
                        {friends.length > 0 && (
                          <p className="mb-2 flex items-center gap-1.5 rounded-md bg-volt-soft px-2 py-1 text-[11px] font-semibold leading-snug text-volt-deep">
                            <Users size={12} className="shrink-0" />
                            <span className="min-w-0">
                              {friends.length === 1
                                ? `${friends[0].name.split(" ")[0]} is playing this slot`
                                : friends.length === 2
                                  ? `${friends[0].name.split(" ")[0]} and ${friends[1].name.split(" ")[0]} are playing this slot`
                                  : `${friends[0].name.split(" ")[0]} and ${friends.length - 1} others you follow are playing`}
                            </span>
                          </p>
                        )}

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
                                  className={`group/player inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                                    r.is_you
                                      ? "border-ink bg-ink text-paper"
                                      : r.you_follow
                                        ? "border-volt bg-volt-soft text-ink ring-1 ring-volt/40"
                                        : r.follows_you
                                          ? "border-volt-deep/40 bg-paper text-ink"
                                          : "border-line bg-paper text-ink hover:border-volt hover:bg-volt-soft"
                                  }`}
                                  title={
                                    r.is_you
                                      ? "This is your booking"
                                      : r.you_follow && r.follows_you
                                        ? `${r.name} — you follow each other`
                                        : r.you_follow
                                          ? `${r.name} — you follow them`
                                          : r.follows_you
                                            ? `${r.name} follows you`
                                            : `View ${r.name}'s profile`
                                  }
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
                </>
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

                <button
                  type="button"
                  onClick={addPicksToCart}
                  disabled={picked.length === 0}
                  className="btn-volt mt-5 w-full"
                >
                  Add to cart <ArrowRight size={16} />
                </button>
                <p className="mt-2 text-center text-[11px] text-ink/45">
                  Court time and gear share one cart and one checkout.
                </p>
              </div>
            </aside>
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
