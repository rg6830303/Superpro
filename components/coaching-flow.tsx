"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Award, Banknote, Check, CreditCard, MessageCircle } from "lucide-react";
import { openRazorpay } from "@/components/razorpay-client";
import { Alert, Spinner, Stepper } from "@/components/ui";
import { upcomingDates, formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { waLink } from "@/lib/site";
import type { Coach, SkillLevel } from "@/lib/types";

const STEPS = ["Choose coach", "Session", "Checkout", "Confirmed"];

const TIMES = ["06:00", "07:00", "08:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

const SESSION_TYPES = [
  { value: "single", label: "1-on-1", note: "Just you and the coach", multiplier: 1 },
  { value: "pair", label: "Pair", note: "You and a partner · 1.5× rate", multiplier: 1.5 },
  { value: "group", label: "Small group", note: "3–4 players · 2× rate, split it", multiplier: 2 },
] as const;

const SKILLS: Array<{ value: SkillLevel; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "pro", label: "DUPR rated" },
];

type SessionType = (typeof SESSION_TYPES)[number]["value"];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function CoachCard({
  coach,
  selected,
  onSelect,
}: {
  coach: Coach;
  selected: boolean;
  onSelect: () => void;
}) {
  const specialties = Array.isArray(coach.specialties) ? coach.specialties : [];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`card-hover flex h-full flex-col p-6 text-left ${selected ? "border-gold shadow-gold" : ""}`}
    >
      <div className="flex items-center gap-4">
        {coach.image_url ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-bone">
            <Image src={coach.image_url} alt={coach.name} fill sizes="64px" className="object-cover" />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-display text-2xl text-gold">
            {initials(coach.name)}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-display text-2xl uppercase text-bone">{coach.name}</p>
          {coach.dupr && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gold">
              <Award size={12} /> DUPR {Number(coach.dupr).toFixed(1)} · {coach.experience_years} yrs
            </p>
          )}
        </div>
        {selected && (
          <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-gold text-ink">
            <Check size={14} />
          </span>
        )}
      </div>

      {coach.headline && <p className="mt-4 text-sm leading-relaxed text-bone/60">{coach.headline}</p>}

      {specialties.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {specialties.map((s) => (
            <span key={s} className="chip py-0.5 text-[10px]">
              {s}
            </span>
          ))}
        </div>
      )}

      <p className="mt-auto pt-5 font-display text-2xl text-gold">
        {formatPaise(coach.rate_paise)}
        <span className="ml-1 font-sans text-xs font-normal text-bone/40">/ session</span>
      </p>
    </button>
  );
}

type Confirmation = {
  booking_no: string;
  coach_name: string;
  coach_whatsapp: string | null;
  amount_paise: number;
  payment_method: string;
  preferred_date: string;
  preferred_time: string;
  sessions_count: number;
};

export function CoachingFlow({
  coaches,
  razorpayEnabled,
  razorpayKeyId,
  defaults,
}: {
  coaches: Coach[];
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  defaults?: { name?: string; email?: string };
}) {
  const [step, setStep] = useState(1);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>("single");
  const [count, setCount] = useState(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState(defaults?.name ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [skill, setSkill] = useState<SkillLevel>("beginner");
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<"razorpay" | "venue">(razorpayEnabled ? "razorpay" : "venue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const coach = useMemo(() => coaches.find((c) => c.id === coachId) ?? null, [coaches, coachId]);
  const multiplier = SESSION_TYPES.find((t) => t.value === sessionType)?.multiplier ?? 1;
  const totalPaise = coach ? Math.round(coach.rate_paise * multiplier * count) : 0;
  const dates = upcomingDates(14);

  function next() {
    setError(null);
    if (step === 1) {
      if (!coachId) return setError("Pick a coach to continue.");
      return setStep(2);
    }
    if (step === 2) {
      if (!date) return setError("Pick a preferred date.");
      if (!time) return setError("Pick a preferred time.");
      return setStep(3);
    }
  }

  async function submit() {
    setError(null);
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) return setError("Enter a valid 10-digit mobile number.");

    setBusy(true);
    try {
      const res = await fetch("/api/coaching/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          coach_id: coachId,
          player_name: name,
          player_phone: phone,
          player_email: email,
          skill_level: skill,
          session_type: sessionType,
          sessions_count: count,
          preferred_date: date,
          preferred_time: time,
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
        prefill: { name, email, contact: phone },
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
        setError("Payment window could not open. Switch to pay-at-venue, or message a rep.");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div>
      <Stepper steps={STEPS} current={step} />

      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}

      {step === 1 && (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c) => (
              <CoachCard key={c.id} coach={c} selected={c.id === coachId} onSelect={() => setCoachId(c.id)} />
            ))}
          </div>
          <div className="mt-7 flex justify-end">
            <button type="button" onClick={next} disabled={!coachId} className="btn-gold">
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}

      {step === 2 && coach && (
        <div className="card max-w-3xl p-7">
          <p className="eyebrow">Coaching with</p>
          <h2 className="mt-1 text-3xl">{coach.name}</h2>
          {coach.bio && <p className="mt-3 text-sm leading-relaxed text-bone/55">{coach.bio}</p>}

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
                  <p className="font-display text-xl uppercase text-bone">{t.label}</p>
                  <p className="mt-1 text-xs text-bone/50">{t.note}</p>
                  <p className="mt-2 text-sm font-semibold text-gold">
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
                  className={`rounded-xl border px-4 py-2.5 font-display text-lg transition-colors ${
                    count === n ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-bone/60 hover:border-white/25"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-bone/35">Blocks of 4+ are scheduled with the coach directly.</p>
          </div>

          <div className="mt-6">
            <span className="label">Preferred first date</span>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={`shrink-0 rounded-xl border px-4 py-2.5 text-center transition-colors ${
                    date === d ? "border-gold bg-gold/10" : "border-white/12 hover:border-white/25"
                  }`}
                >
                  <span className={`block text-[10px] font-semibold uppercase tracking-wider ${date === d ? "text-gold" : "text-bone/45"}`}>
                    {formatDate(d).split(",")[0]}
                  </span>
                  <span className="block font-display text-lg text-bone">{formatDate(d).split(", ")[1]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <span className="label">Preferred time</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={`rounded-lg border py-2.5 text-xs font-semibold transition-colors ${
                    time === t ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-bone/60 hover:border-white/25"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-outline">
              <ArrowLeft size={16} /> Change coach
            </button>
            <button type="button" onClick={next} className="btn-gold">
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && coach && (
        <div className="card max-w-2xl p-7">
          <h2 className="text-2xl">Your details</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="c-name">Full name</label>
              <input id="c-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ishaan Sanghvi" />
            </div>
            <div>
              <label className="label" htmlFor="c-phone">WhatsApp number</label>
              <input id="c-phone" className="field" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" />
            </div>
            <div>
              <label className="label" htmlFor="c-email">Email (optional)</label>
              <input id="c-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="mt-5">
            <span className="label">Your level</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SKILLS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSkill(s.value)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    skill === s.value ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-bone/60 hover:border-white/25"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <dl className="mt-6 space-y-2.5 border-t border-white/10 pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-bone/55">Coach</dt>
              <dd className="text-bone">{coach.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-bone/55">Format</dt>
              <dd className="text-bone capitalize">{sessionType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-bone/55">Sessions</dt>
              <dd className="text-bone">{count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-bone/55">First session</dt>
              <dd className="text-bone">{date ? `${formatDate(date)} · ${time}` : "—"}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3">
              <dt className="font-display text-xl uppercase text-bone">Total</dt>
              <dd className="font-display text-xl text-gold">{formatPaise(totalPaise)}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <span className="label">Payment</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => razorpayEnabled && setPay("razorpay")}
                disabled={!razorpayEnabled}
                className={`tile ${pay === "razorpay" ? "tile-selected" : ""} ${!razorpayEnabled ? "opacity-40" : ""}`}
              >
                <CreditCard size={18} className="text-gold" />
                <p className="mt-2 font-display text-lg uppercase text-bone">Pay online</p>
                <p className="mt-1 text-xs text-bone/50">Coach confirms within a few hours.</p>
              </button>
              <button type="button" onClick={() => setPay("venue")} className={`tile ${pay === "venue" ? "tile-selected" : ""}`}>
                <Banknote size={18} className="text-gold" />
                <p className="mt-2 font-display text-lg uppercase text-bone">Pay at the court</p>
                <p className="mt-1 text-xs text-bone/50">Settle directly before the first session.</p>
              </button>
            </div>
          </div>

          <div className="mt-5">
            <label className="label" htmlFor="c-notes">What do you want to work on? (optional)</label>
            <textarea id="c-notes" rows={2} className="field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Third shot drop, serve consistency…" />
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn-outline">
              <ArrowLeft size={16} /> Back
            </button>
            <button type="button" onClick={submit} disabled={busy} className="btn-gold">
              {busy ? <Spinner /> : null}
              {busy ? "Booking…" : pay === "razorpay" ? `Pay ${formatPaise(totalPaise)}` : "Request session"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && confirmation && (
        <div className="card max-w-2xl p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok text-ink">
            <Check size={28} />
          </div>
          <h2 className="mt-5 text-4xl">You&apos;re booked with {confirmation.coach_name.split(" ")[0]}</h2>
          <p className="mt-3 text-sm text-bone/55">
            Booking <span className="font-semibold text-gold">{confirmation.booking_no}</span> ·{" "}
            {confirmation.sessions_count} session{confirmation.sessions_count > 1 ? "s" : ""}, starting{" "}
            {formatDate(confirmation.preferred_date)} at {confirmation.preferred_time}.
          </p>
          <p className="mt-3 text-sm text-bone/45">
            SuperPro connects you to your coach on WhatsApp to lock the exact timing. Expect a message within a
            few hours.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a
              href={waLink(
                `Hi SuperPro! I've booked coaching with ${confirmation.coach_name} (ref ${confirmation.booking_no}).`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-[#25D366] text-ink hover:brightness-110"
            >
              <MessageCircle size={16} /> Message SuperPro
            </a>
            <Link href="/games" className="btn-outline">
              Book a game too
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
