"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { useRazorpayPreload } from "@/components/razorpay-client";
import { payForRegistration } from "@/components/coaching-pay";

type Props = {
  fee: number;
  doctorHandle: string;
  concerns: readonly string[];
  slots: readonly string[];
  razorpayEnabled: boolean;
  prefill: { name: string; phone: string; email: string; age: string; gender: string } | null;
};

const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const istPlus = (days: number) => new Date(Date.now() + 5.5 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);

export function DoctorBookingForm({ fee, doctorHandle, concerns, slots, razorpayEnabled, prefill }: Props) {
  const router = useRouter();
  useRazorpayPreload(razorpayEnabled);
  const [name, setName] = useState(prefill?.name ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [age, setAge] = useState(prefill?.age ?? "");
  const [gender, setGender] = useState(prefill?.gender ?? "");
  const [concern, setConcern] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(istPlus(1));
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState<false | "pay" | "later">(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(payNow: boolean) {
    setError(null);
    if (!gender) return setError("Choose a gender.");
    if (!concern) return setError("Choose what you need help with.");
    if (!slot) return setError("Choose a preferred time.");
    setBusy(payNow ? "pay" : "later");
    try {
      const res = await fetch("/api/medical/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, email, age: Number(age), gender, concern, details, preferredDate: date, preferredSlot: slot, payNow: payNow && razorpayEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save your booking.");
      if (payNow && data.order) {
        const outcome = await payForRegistration(data, {
          kind: "doctor_appointment",
          name: `${doctorHandle} · Clinic visit`,
          description: `Consultation · ${data.reference}`,
        });
        router.push(`/medical/appointment/${data.reference}${outcome === "paid" ? "?paid=1" : ""}`);
        return;
      }
      router.push(`/medical/appointment/${data.reference}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const chip = (on: boolean) =>
    `inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-4 text-sm font-medium transition-colors ${
      on ? "border-volt-deep bg-volt-soft text-ink" : "border-line bg-paper text-ink/70 hover:border-ink/30"
    }`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(true);
      }}
      className="card space-y-5 p-5 sm:p-7"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="d-name">Patient name <span className="text-signal">*</span></label>
          <input id="d-name" className="field" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label className="label" htmlFor="d-phone">Mobile <span className="text-signal">*</span></label>
          <input id="d-phone" className="field" type="tel" inputMode="numeric" autoComplete="tel-national" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp number" />
        </div>
        <div>
          <label className="label" htmlFor="d-age">Age <span className="text-signal">*</span></label>
          <input id="d-age" className="field" type="number" inputMode="numeric" min={3} max={100} required value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 32" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="d-email">Email <span className="text-ink/40">(for your receipt)</span></label>
          <input id="d-email" className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
      </div>

      <div>
        <p className="label">Gender <span className="text-signal">*</span></p>
        <div className="flex flex-wrap gap-2">
          {["Male", "Female", "Other"].map((g) => (
            <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(g)} className={chip(gender === g)}>
              {gender === g && <Check size={14} className="text-volt-deep" />} {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="d-concern">What do you need help with? <span className="text-signal">*</span></label>
        <select id="d-concern" className="field" value={concern} onChange={(e) => setConcern(e.target.value)} required>
          <option value="">Choose…</option>
          {concerns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="d-details">Tell us a little more</label>
        <textarea id="d-details" className="field min-h-[84px]" value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} placeholder="Where it hurts, since when, how it happened…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <div>
          <label className="label" htmlFor="d-date">Preferred date <span className="text-signal">*</span></label>
          <input id="d-date" className="field" type="date" min={istToday()} max={istPlus(60)} required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <p className="label">Preferred time <span className="text-signal">*</span></p>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)} className={chip(slot === s)}>
                {slot === s && <Check size={14} className="text-volt-deep" />} {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-mist/50 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="shrink-0">
            <p className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Clinic consultation</p>
            <p className="whitespace-nowrap font-display text-3xl text-ink">₹{fee.toLocaleString("en-IN")}</p>
          </div>
          <p className="text-xs text-ink/55 sm:max-w-[14rem] sm:text-right">{doctorHandle} confirms your exact time and the clinic location on WhatsApp.</p>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-col gap-2 sm:flex-row">
        {razorpayEnabled && (
          <button type="submit" disabled={!!busy} className="btn-volt flex-1">
            {busy === "pay" ? <Spinner /> : null} {busy === "pay" ? "Opening payment…" : `Pay ₹${fee} & book`}
          </button>
        )}
        <button type="button" disabled={!!busy} onClick={() => void submit(false)} className={razorpayEnabled ? "btn-outline flex-1" : "btn-volt flex-1"}>
          {busy === "later" ? <Spinner /> : null} {razorpayEnabled ? "Request now, pay later" : "Request appointment"}
        </button>
      </div>
      <p className="text-center text-xs text-ink/45">In an emergency, call 112 — don&apos;t wait for an appointment.</p>
    </form>
  );
}
