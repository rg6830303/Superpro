"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Banknote, Check, CreditCard, MapPin, MessageCircle, Users, Wallet } from "lucide-react";
import { openRazorpay } from "@/components/razorpay-client";
import { Alert, Spinner, Stepper } from "@/components/ui";
import { Confetti } from "@/components/motion";
import { formatDate, formatTime, formatTimeRange, isPast } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { waLink, WHATSAPP_GROUP_URL } from "@/lib/site";
import type { GameSession, SkillLevel } from "@/lib/types";

const STEPS = ["Register", "Pick slots", "Checkout", "Confirmed"];

const SKILLS: Array<{ value: SkillLevel; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "pro", label: "DUPR rated" },
];

type Confirmation = {
  reference: string;
  total_paise: number;
  payment_method: string;
  bookings: Array<{
    session_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    court_number: number;
    status: string;
  }>;
};

export function GamesFlow({
  sessions,
  razorpayEnabled,
  razorpayKeyId,
  walletPaise = 0,
  defaults,
}: {
  sessions: GameSession[];
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  /** Signed-in player's wallet balance; 0 (or signed out) hides the option. */
  walletPaise?: number;
  defaults?: { name?: string; phone?: string; email?: string; skill?: SkillLevel };
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(defaults?.name ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [skill, setSkill] = useState<SkillLevel>(defaults?.skill ?? "beginner");
  const [players, setPlayers] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [pay, setPay] = useState<"razorpay" | "venue" | "wallet">(razorpayEnabled ? "razorpay" : "venue");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  // Group the week's sessions by date so the picker reads like a calendar.
  const byDate = useMemo(() => {
    const map = new Map<string, GameSession[]>();
    for (const s of sessions) {
      if (!map.has(s.session_date)) map.set(s.session_date, []);
      map.get(s.session_date)!.push(s);
    }
    return map;
  }, [sessions]);

  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate]);
  const shownDate = activeDate && byDate.has(activeDate) ? activeDate : dates[0];
  const daySessions = shownDate ? (byDate.get(shownDate) ?? []) : [];

  const pickedSessions = useMemo(
    () => sessions.filter((s) => picked.includes(s.id)),
    [sessions, picked],
  );
  const totalPaise = pickedSessions.reduce((sum, s) => sum + s.price_paise * players, 0);

  const spotsLeft = (s: GameSession) => s.capacity - (s.booked ?? 0);

  function toggle(session: GameSession) {
    if (spotsLeft(session) < players) return;
    setPicked((prev) =>
      prev.includes(session.id) ? prev.filter((id) => id !== session.id) : [...prev, session.id],
    );
  }

  function validateStep1() {
    if (name.trim().length < 2) return "Enter your full name.";
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) return "Enter a valid 10-digit mobile number.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return "That email doesn't look right.";
    return null;
  }

  function next() {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) return setError(err);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (picked.length === 0) return setError("Pick at least one slot to continue.");
      setStep(3);
    }
  }

  async function confirmBooking() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/games/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          player_name: name,
          player_phone: phone,
          player_email: email,
          skill_level: skill,
          session_ids: picked,
          players_count: players,
          payment_method: pay,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not complete the booking.");

      if (!data.razorpay_order_id) {
        setConfirmation(data);
        setStep(4);
        setBusy(false);
        return;
      }

      const opened = await openRazorpay({
        keyId: razorpayKeyId,
        orderId: data.razorpay_order_id,
        amountPaise: data.total_paise,
        name: "SuperPro Daily Games",
        description: `${picked.length} slot${picked.length > 1 ? "s" : ""}`,
        prefill: { name, email, contact: phone },
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
            setStep(4);
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
    setStep(2);
  }

  return (
    <div>
      <Stepper steps={STEPS} current={step} />

      {/* Keyed on the step so a change replays the entrance rather than
          swapping content in place. */}
      <div key={step} className="step-in">

      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* ── Step 1 — register ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card max-w-2xl p-7">
          <h2 className="text-2xl">Player details</h2>
          <p className="mt-1.5 text-sm text-ink/65">
            One time only. Next week, the same number picks up where you left off.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="g-name">Full name</label>
              <input id="g-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ishaan Sanghvi" />
            </div>
            <div>
              <label className="label" htmlFor="g-phone">WhatsApp number</label>
              <input id="g-phone" className="field" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" />
              <p className="mt-1.5 text-[11px] text-ink/45">Your confirmation and court number come here.</p>
            </div>
            <div>
              <label className="label" htmlFor="g-email">Email (optional)</label>
              <input id="g-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          <div className="mt-6">
            <span className="label">Skill level</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SKILLS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSkill(s.value)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    skill === s.value ? "border-ink bg-volt-soft text-volt-deep" : "border-line text-ink/70 hover:border-line-strong"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <span className="label">How many of you are coming?</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPlayers(n)}
                  className={`h-11 w-11 rounded-xl border font-display text-lg transition-colors ${
                    players === n ? "border-ink bg-volt-soft text-volt-deep" : "border-line text-ink/70 hover:border-line-strong"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-ink/45">Bringing friends? We&apos;ll hold that many spots per slot.</p>
          </div>

          <div className="mt-7 flex justify-end">
            <button type="button" onClick={next} className="btn-volt">
              Pick your slots <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — slot picking ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="card min-w-0 p-6">
            <h2 className="text-2xl">This week&apos;s slots</h2>
            <p className="mt-1.5 text-sm text-ink/65">
              Pick as many as you like — one tap each. Full slots are greyed out.
            </p>

            {dates.length === 0 ? (
              <div className="mt-8 rounded-xl border border-line p-8 text-center">
                <p className="font-display text-xl text-ink/75">No slots published yet</p>
                <p className="mt-2 text-sm text-ink/55">The week&apos;s schedule goes up every Sunday evening.</p>
                <a href={waLink("Hi SuperPro! When do this week's slots open?")} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm mt-5">
                  <MessageCircle size={14} /> Ask a rep
                </a>
              </div>
            ) : (
              <>
                <div className="scroll-x mt-6 flex gap-2 pb-2 no-scrollbar">
                  {dates.map((d) => {
                    const open = (byDate.get(d) ?? []).filter(
                      (s) => spotsLeft(s) > 0 && !isPast(s.session_date, s.start_time),
                    ).length;
                    const isActive = d === shownDate;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setActiveDate(d)}
                        className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition-colors ${
                          isActive ? "border-ink bg-volt-soft" : "border-line hover:border-line-strong"
                        }`}
                      >
                        <span className={`block font-mono text-[11px] uppercase tracking-[0.14em] ${isActive ? "text-volt-deep" : "text-ink/55"}`}>
                          {formatDate(d).split(",")[0]}
                        </span>
                        <span className={`block font-display text-lg ${isActive ? "text-ink" : "text-ink/75"}`}>
                          {formatDate(d).split(", ")[1]}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-ink/45">{open} open</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {daySessions.map((s) => {
                    const left = spotsLeft(s);
                    const past = isPast(s.session_date, s.start_time);
                    const disabled = past || left < players;
                    const selected = picked.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => !disabled && toggle(s)}
                        disabled={disabled}
                        className={`tile ${selected ? "tile-selected" : ""} ${disabled ? "tile-disabled" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-display text-2xl text-ink">{formatTime(s.start_time)}</span>
                          {selected ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-volt text-ink">
                              <Check size={12} />
                            </span>
                          ) : (
                            <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${left <= 2 ? "text-amber" : "text-volt-deep"}`}>
                              {past ? "Started" : left <= 0 ? "Full" : `${left} left`}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-ink/65">{formatTimeRange(s.start_time, s.end_time)}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/70">
                          <MapPin size={11} /> {s.venue_name} · Court {s.court_number}
                        </p>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="chip py-0.5 text-[10px]">{s.level === "all" ? "All levels" : s.level}</span>
                          <span className="text-sm font-semibold text-volt-deep">{formatPaise(s.price_paise)}</span>
                        </div>
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
              {pickedSessions.length === 0 ? (
                <p className="mt-3 text-sm text-ink/55">Nothing picked yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {pickedSessions.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
                      <span>
                        <span className="block text-ink">{formatDate(s.session_date)} · {formatTime(s.start_time)}</span>
                        <span className="block text-xs text-ink/55">{s.venue_name} · Court {s.court_number}</span>
                      </span>
                      <button type="button" onClick={() => toggle(s)} className="text-xs text-ink/45 hover:text-signal">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <span className="text-sm text-ink/70">
                  {picked.length} slot{picked.length === 1 ? "" : "s"} × {players} player{players === 1 ? "" : "s"}
                </span>
                <span className="font-display text-2xl text-volt-deep">{formatPaise(totalPaise)}</span>
              </div>

              <button type="button" onClick={next} disabled={picked.length === 0} className="btn-volt mt-5 w-full">
                Continue to checkout <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => setStep(1)} className="btn-ghost mt-2 w-full">
                <ArrowLeft size={15} /> Back to details
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Step 3 — checkout ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="card max-w-2xl p-7">
          <h2 className="text-2xl">Checkout</h2>

          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/70">Player</dt>
              <dd className="text-ink">{name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/70">WhatsApp</dt>
              <dd className="text-ink">+91 {phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/70">Playing as</dt>
              <dd className="text-ink capitalize">{skill}</dd>
            </div>
          </dl>

          <ul className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
            {pickedSessions.map((s) => (
              <li key={s.id} className="flex justify-between gap-4">
                <span className="text-ink/75">
                  {formatDate(s.session_date)} · {formatTime(s.start_time)} · {s.venue_name} C{s.court_number}
                </span>
                <span className="text-ink/80">{formatPaise(s.price_paise * players)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-4 border-t border-line pt-3">
              <span className="font-display text-xl uppercase text-ink">Total</span>
              <span className="font-display text-xl text-volt-deep">{formatPaise(totalPaise)}</span>
            </li>
          </ul>

          <div className="mt-6">
            <span className="label">Payment</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {walletPaise > 0 && (
                <button
                  type="button"
                  onClick={() => setPay("wallet")}
                  disabled={walletPaise < totalPaise}
                  className={`tile ${pay === "wallet" ? "tile-selected" : ""} ${walletPaise < totalPaise ? "opacity-40" : ""}`}
                >
                  <Wallet size={18} className="text-volt-deep" />
                  <p className="mt-2 font-display text-lg uppercase text-ink">SuperPro wallet</p>
                  <p className="mt-1 text-xs text-ink/65">
                    {walletPaise < totalPaise
                      ? `Only ${formatPaise(walletPaise)} left — top up with a rep.`
                      : `${formatPaise(walletPaise)} available. Confirms instantly.`}
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
                <p className="mt-1 text-xs text-ink/65">
                  {razorpayEnabled ? "UPI or card. Slot confirms instantly." : "Temporarily unavailable."}
                </p>
              </button>
              <button type="button" onClick={() => setPay("venue")} className={`tile ${pay === "venue" ? "tile-selected" : ""}`}>
                <Banknote size={18} className="text-volt-deep" />
                <p className="mt-2 font-display text-lg uppercase text-ink">Pay at venue</p>
                <p className="mt-1 text-xs text-ink/65">Held for 20 minutes from slot start.</p>
              </button>
            </div>
          </div>

          <div className="mt-5">
            <label className="label" htmlFor="g-notes">Notes for the organiser (optional)</label>
            <textarea id="g-notes" rows={2} className="field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bringing a friend, need a spare paddle…" />
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn-outline">
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

      {/* ── Step 4 — confirmed ────────────────────────────────────────── */}
      {step === 4 && confirmation && (
        <div className="card relative max-w-2xl overflow-hidden p-8 text-center">
          <Confetti trigger={confirmation ? 1 : 0} />
          <div className="mx-auto flex h-16 w-16 animate-score-pop items-center justify-center rounded-full bg-volt text-ink">
            <Check size={30} strokeWidth={3} />
          </div>
          <h2 className="mt-5 text-4xl">
            {confirmation.payment_method === "razorpay" || confirmation.payment_method === "wallet"
              ? "Paid & confirmed"
              : "Slot confirmed"}
          </h2>
          <p className="mt-3 text-sm text-ink/70">
            Reference <span className="font-semibold text-volt-deep">{confirmation.reference}</span>.
            {confirmation.payment_method === "razorpay"
              ? " See you on court."
              : confirmation.payment_method === "wallet"
                ? " Paid from your SuperPro wallet. See you on court."
                : " Pay at the venue — your spot is held for 20 minutes from the start time."}
          </p>

          <ul className="mt-7 space-y-3 border-t border-line pt-6 text-left">
            {confirmation.bookings.map((b, i) => (
              <li key={i} className="flex items-center justify-between gap-4 rounded-xl bg-mist px-4 py-3">
                <span>
                  <span className="block font-display text-xl text-ink">
                    {formatDate(b.session_date)} · {formatTime(b.start_time)}
                  </span>
                  <span className="block text-xs text-ink/65">{b.venue_name}</span>
                </span>
                <span className="rounded-lg bg-volt px-3 py-1.5 font-display text-lg text-ink">
                  Court {b.court_number}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-7 rounded-xl border border-line bg-mist p-4 text-left">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Users size={15} className="text-volt-deep" /> Posted to the games group
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink/65">
              Your name and court number go into the SuperPro daily-games WhatsApp group so everyone knows who
              they&apos;re playing with.
            </p>
            {WHATSAPP_GROUP_URL && (
              <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm mt-3">
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
    </div>
  );
}
