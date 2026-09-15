"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Award, Banknote, Check, CreditCard, MessageCircle } from "lucide-react";
import { openRazorpay } from "@/components/razorpay-client";
import { SignInGate } from "@/components/sign-in-gate";
import { Alert, Spinner, Stepper } from "@/components/ui";
import { Confetti } from "@/components/motion";
import { formatPaise } from "@/lib/money";
import { initials } from "@/lib/profile";
import { waLink } from "@/lib/site";
import type { Coach } from "@/lib/types";

const STEPS = ["Choose coach", "Session", "Checkout", "Connected"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SESSION_TYPES = [
  { value: "single", label: "1-on-1", note: "Just you and the coach", multiplier: 1 },
  { value: "pair", label: "Pair", note: "You and a partner · 1.5× rate", multiplier: 1.5 },
  { value: "group", label: "Small group", note: "3–4 players · 2× rate, split it", multiplier: 2 },
] as const;

type SessionType = (typeof SESSION_TYPES)[number]["value"];

export type CoachAvailability = { coach_id: string; weekday: number; start_time: string; end_time: string };

type Confirmation = {
  booking_no: string;
  coach_name: string;
  coach_whatsapp: string | null;
  amount_paise: number;
  payment_method: string;
  sessions_count: number;
};

export function CoachCard({
  coach,
  availability,
  selected,
  onSelect,
}: {
  coach: Coach;
  availability: CoachAvailability[];
  selected: boolean;
  onSelect: () => void;
}) {
  const specialties = Array.isArray(coach.specialties) ? coach.specialties : [];
  const days = [...new Set(availability.map((a) => a.weekday))].sort();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`card-hover flex h-full flex-col overflow-hidden text-left ${selected ? "border-ink shadow-card" : ""}`}
    >
      {/* A coach is a person you are choosing to spend an hour with — the photo
          carries more than any amount of copy. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-mist">
        {coach.image_url ? (
          <Image
            src={coach.image_url}
            alt={coach.name}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center font-display text-5xl text-ink/20">
            {initials(coach.name)}
          </span>
        )}
        {selected && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-volt text-ink">
            <Check size={15} strokeWidth={3} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="font-display text-2xl text-ink">{coach.name}</p>
        {coach.dupr && (
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-volt-deep">
            <Award size={12} /> DUPR {Number(coach.dupr).toFixed(1)} · {coach.experience_years} yrs
          </p>
        )}
        {coach.headline && <p className="mt-3 text-sm leading-relaxed text-ink/65">{coach.headline}</p>}

        {specialties.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {specialties.slice(0, 3).map((sp) => (
              <span key={sp} className="chip py-0.5 text-[10px]">
                {sp}
              </span>
            ))}
          </div>
        )}

        {days.length > 0 && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            Usually {days.map((d) => WEEKDAYS[d]).join(" · ")}
          </p>
        )}

        <p className="mt-auto pt-5 font-display text-2xl tabular-nums text-volt-deep">
          {formatPaise(coach.rate_paise)}
          <span className="ml-1 font-sans text-xs font-normal text-ink/45">/ session</span>
        </p>
      </div>
    </button>
  );
}

/**
 * Coaching request.
 *
 * No date is picked here. A coach's real availability shifts week to week, so
 * asking a player to guess a slot only produces a booking that has to be
 * renegotiated. The player chooses a coach and a block; SuperPro connects the
 * two on WhatsApp and the date is set once the coach has confirmed it.
 */
export function CoachingFlow({
  coaches,
  availability = [],
  razorpayEnabled,
  razorpayKeyId,
  player,
}: {
  coaches: Coach[];
  availability?: CoachAvailability[];
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  player: { name: string; phone: string; email: string; skill: string } | null;
}) {
  const [step, setStep] = useState(1);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>("single");
  const [count, setCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<"razorpay" | "venue">(razorpayEnabled ? "razorpay" : "venue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const coach = useMemo(() => coaches.find((c) => c.id === coachId) ?? null, [coaches, coachId]);
  const multiplier = SESSION_TYPES.find((t) => t.value === sessionType)?.multiplier ?? 1;
  const totalPaise = coach ? Math.round(coach.rate_paise * multiplier * count) : 0;
  const coachDays = availability.filter((a) => a.coach_id === coachId);

  function next() {
    setError(null);
    if (step === 1) {
      if (!coachId) return setError("Pick a coach to continue.");
      return setStep(2);
    }
    if (step === 2) setStep(3);
  }

  async function submit() {
    if (!player) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/coaching/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          coach_id: coachId,
          player_name: player.name,
          player_phone: player.phone,
          player_email: player.email,
          skill_level: player.skill,
          session_type: sessionType,
          sessions_count: count,
          payment_method: pay,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not book that session.");

      if (!data.razorpay_order_id) {
        setConfirmation(data);
        setStep(4);
        setBusy(false);
        return;
      }

      const opened = await openRazorpay({
        keyId: razorpayKeyId,
        orderId: data.razorpay_order_id,
        amountPaise: data.amount_paise,
        name: "SuperPro Coaching",
        description: `${count} session${count > 1 ? "s" : ""} with ${data.coach_name}`,
        prefill: { name: player.name, email: player.email, contact: player.phone },
        notes: { booking_no: data.booking_no },
        onSuccess: async (payload) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "coaching", reference: data.booking_no, ...payload }),
          });
          if (verify.ok) {
            setConfirmation({ ...data, payment_method: "razorpay" });
            setStep(4);
          } else {
            setError("Payment could not be verified. Message a rep with your booking number.");
          }
          setBusy(false);
        },
        onDismiss: () => setBusy(false),
      });

      if (!opened) {
        setError("Payment window could not open. Switch to pay-at-court, or message a rep.");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!player) {
    return (
      <SignInGate
        title="Sign in to book coaching"
        detail="Your coach needs to know who they are working with, and your rating shapes the first session."
        next="/coaching"
      />
    );
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
        {step === 1 && (
          <>
            <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map((c) => (
                <CoachCard
                  key={c.id}
                  coach={c}
                  availability={availability.filter((a) => a.coach_id === c.id)}
                  selected={c.id === coachId}
                  onSelect={() => setCoachId(c.id)}
                />
              ))}
            </div>
            <div className="mt-7 flex justify-end">
              <button type="button" onClick={next} disabled={!coachId} className="btn-volt">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {step === 2 && coach && (
          <div className="card max-w-3xl p-7">
            <p className="eyebrow">Coaching with</p>
            <h2 className="mt-1 text-3xl">{coach.name}</h2>
            {coach.bio && <p className="mt-3 text-sm leading-relaxed text-ink/65">{coach.bio}</p>}

            {coachDays.length > 0 && (
              <div className="mt-5 rounded-xl border border-line bg-mist p-4">
                <p className="label mb-2">When they usually coach</p>
                <div className="flex flex-wrap gap-2">
                  {coachDays.map((a, i) => (
                    <span key={i} className="chip">
                      {WEEKDAYS[a.weekday]} {a.start_time}–{a.end_time}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-ink/55">
                  Indicative only. You and {coach.name.split(" ")[0]} agree the exact date on WhatsApp once this
                  request is in — that way nobody books a slot the coach cannot make.
                </p>
              </div>
            )}

            <div className="mt-7">
              <span className="label">Session format</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {SESSION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSessionType(t.value)}
                    className={`tile ${sessionType === t.value ? "tile-selected" : ""}`}
                  >
                    <p className="font-display text-xl uppercase text-ink">{t.label}</p>
                    <p className="mt-1 text-xs text-ink/55">{t.note}</p>
                    <p className="mt-2 text-sm font-semibold tabular-nums text-volt-deep">
                      {formatPaise(Math.round(coach.rate_paise * t.multiplier))}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <span className="label">How many sessions?</span>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 4, 8, 12].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`rounded-xl border px-4 py-2.5 font-display text-lg tabular-nums transition-colors ${
                      count === n ? "border-ink bg-volt-soft text-ink" : "border-line text-ink/60 hover:border-ink/40"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="label" htmlFor="c-notes">
                What do you want to work on?
              </label>
              <textarea
                id="c-notes"
                rows={3}
                className="field resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                
              />
              <p className="mt-1.5 text-[11px] text-ink/45">Goes straight to the coach before they call you.</p>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-outline">
                <ArrowLeft size={16} /> Change coach
              </button>
              <button type="button" onClick={next} className="btn-volt">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && coach && (
          <div className="card max-w-2xl p-7">
            <h2 className="text-2xl">Confirm your request</h2>

            <dl className="mt-5 space-y-2.5 border-b border-line pb-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/60">Player</dt>
                <dd className="text-ink">{player.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">Coach</dt>
                <dd className="text-ink">{coach.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">Format</dt>
                <dd className="capitalize text-ink">{sessionType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">Sessions</dt>
                <dd className="tabular-nums text-ink">{count}</dd>
              </div>
              <div className="flex justify-between pt-2">
                <dt className="font-display text-xl text-ink">Total</dt>
                <dd className="font-display text-xl tabular-nums text-volt-deep">{formatPaise(totalPaise)}</dd>
              </div>
            </dl>

            <div className="mt-5">
              <Alert tone="info">
                Dates are set with your coach directly. SuperPro passes this request straight to{" "}
                {coach.name.split(" ")[0]}, who confirms timing on WhatsApp — usually within a few hours.
              </Alert>
            </div>

            <div className="mt-6">
              <span className="label">Payment</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => razorpayEnabled && setPay("razorpay")}
                  disabled={!razorpayEnabled}
                  className={`tile ${pay === "razorpay" ? "tile-selected" : ""} ${!razorpayEnabled ? "opacity-40" : ""}`}
                >
                  <CreditCard size={18} className="text-volt-deep" />
                  <p className="mt-2 font-display text-lg uppercase text-ink">Pay online</p>
                  <p className="mt-1 text-xs text-ink/55">Reserves the block with the coach.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPay("venue")}
                  className={`tile ${pay === "venue" ? "tile-selected" : ""}`}
                >
                  <Banknote size={18} className="text-volt-deep" />
                  <p className="mt-2 font-display text-lg uppercase text-ink">Pay at the court</p>
                  <p className="mt-1 text-xs text-ink/55">Settle before the first session.</p>
                </button>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(2)} className="btn-outline">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="button" onClick={submit} disabled={busy} className="btn-volt">
                {busy ? <Spinner /> : null}
                {busy ? "Sending…" : pay === "razorpay" ? `Pay ${formatPaise(totalPaise)}` : "Send request"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && confirmation && (
          <div className="card relative max-w-2xl overflow-hidden p-8 text-center">
            <Confetti trigger={1} />
            <div className="mx-auto flex h-16 w-16 animate-score-pop items-center justify-center rounded-full bg-volt text-ink">
              <Check size={30} strokeWidth={3} />
            </div>
            <h2 className="headline-section mt-5">
              You&apos;re connected with {confirmation.coach_name.split(" ")[0]}
            </h2>
            <p className="mt-3 text-sm text-ink/60">
              Booking <span className="font-semibold text-volt-deep">{confirmation.booking_no}</span> ·{" "}
              {confirmation.sessions_count} session{confirmation.sessions_count > 1 ? "s" : ""}.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              {confirmation.coach_name} has your request and what you want to work on. They will message you on
              WhatsApp to fix the date — it appears in your account as soon as it is agreed.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a
                href={waLink(
                  `Hi SuperPro! I've booked coaching with ${confirmation.coach_name} (ref ${confirmation.booking_no}).`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                <MessageCircle size={16} /> Message SuperPro
              </a>
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
