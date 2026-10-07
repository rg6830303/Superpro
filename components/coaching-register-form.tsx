"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Clock, HeartPulse, MapPin, ShieldCheck, User } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { useRazorpayPreload } from "@/components/razorpay-client";
import { payForRegistration } from "@/components/coaching-pay";
import {
  DAYS,
  GENDERS,
  KIDS_MAX_AGE,
  MIN_DAYS,
  MIN_TIMINGS,
  PROGRAM,
  SKILLS,
  TIMINGS,
  VENUES,
  feeFor,
  formatRupees,
} from "@/lib/coaching-program";

type Prefill = { name: string; phone: string; email: string; gender: string; age: string } | null;

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "border-volt-deep bg-volt-soft text-ink" : "border-line bg-paper text-ink/70 hover:border-ink/30"
      }`}
    >
      {on && <Check size={14} className="text-volt-deep" />}
      {children}
    </button>
  );
}

function Section({ icon: Icon, step, title, hint, children }: { icon: typeof User; step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="card min-w-0 p-5 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-volt-soft text-volt-deep">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Step {step}</p>
          <h2 className="text-xl font-bold text-ink">{title}</h2>
          {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
        </div>
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </fieldset>
  );
}

export function CoachingRegisterForm({ prefill, razorpayEnabled }: { prefill: Prefill; razorpayEnabled: boolean }) {
  const router = useRouter();
  useRazorpayPreload(razorpayEnabled);

  const [name, setName] = useState(prefill?.name ?? "");
  const [gender, setGender] = useState(prefill?.gender ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [age, setAge] = useState(prefill?.age ?? "");
  const [skill, setSkill] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [timings, setTimings] = useState<string[]>([]);
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [medical, setMedical] = useState("");
  const [payVenue, setPayVenue] = useState("");
  const [busy, setBusy] = useState<false | "pay" | "later">(false);
  const [error, setError] = useState<string | null>(null);

  const ageNum = Number(age);
  const isKid = age !== "" && Number.isFinite(ageNum) && ageNum <= KIDS_MAX_AGE;
  // The venue charged for: the one chosen, else the first picked that is offered for this age.
  const chargeVenue = useMemo(() => {
    if (payVenue && venues.includes(payVenue) && feeFor(payVenue, ageNum || 30) != null) return payVenue;
    return venues.find((v) => feeFor(v, ageNum || 30) != null) ?? "";
  }, [payVenue, venues, ageNum]);
  const fee = chargeVenue ? feeFor(chargeVenue, ageNum || 30) : null;

  function pickVenue(id: string) {
    setVenues((v) => toggle(v, id));
  }

  async function submit(payNow: boolean) {
    setError(null);
    if (!gender) return setError("Choose a gender.");
    if (!skill) return setError("Choose your skill level.");
    if (days.length < MIN_DAYS) return setError(`Pick at least ${MIN_DAYS} preferred days — it helps us form your group.`);
    if (timings.length < MIN_TIMINGS) return setError(`Pick at least ${MIN_TIMINGS} preferred timings.`);
    if (venues.length === 0) return setError("Pick at least one venue.");
    if (!chargeVenue) return setError("Ballygunge Arena is for adults only — pick another venue for under-16s.");

    setBusy(payNow ? "pay" : "later");
    try {
      const res = await fetch("/api/coaching/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, gender, phone, email, age: ageNum, skill, days, venues, timings,
          emergencyPhone, emergencyRelation, medical, payVenue: chargeVenue, payNow: payNow && razorpayEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save your registration.");

      if (payNow && data.order) {
        const outcome = await payForRegistration(data);
        router.push(`/coaching/registration/${data.reference}${outcome === "paid" ? "?paid=1" : ""}`);
        return;
      }
      router.push(`/coaching/registration/${data.reference}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(true);
      }}
      className="space-y-5"
    >
      <Section icon={User} step={1} title="About you">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="r-name">Name <span className="text-signal">*</span></label>
            <input id="r-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Full name" />
          </div>
          <div>
            <label className="label" htmlFor="r-phone">Contact <span className="text-signal">*</span></label>
            <input id="r-phone" className="field" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="WhatsApp number" />
          </div>
          <div>
            <label className="label" htmlFor="r-age">Age <span className="text-signal">*</span></label>
            <input id="r-age" className="field" type="number" inputMode="numeric" min={4} max={90} value={age} onChange={(e) => setAge(e.target.value)} required placeholder="e.g. 28" />
            {isKid && <p className="mt-1 text-[12px] font-medium text-volt-deep">Under-16 rate applies.</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="r-email">Email <span className="text-ink/40">(for your receipt)</span></label>
            <input id="r-email" className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        </div>
        <div>
          <p className="label">Gender <span className="text-signal">*</span></p>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <Chip key={g} on={gender === g} onClick={() => setGender(g)}>{g}</Chip>
            ))}
          </div>
        </div>
      </Section>

      <Section icon={ShieldCheck} step={2} title="Skill level" hint="Please be accurate — it's how we group players of the same level.">
        <div className="grid gap-2">
          {SKILLS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSkill(s.id)}
              aria-pressed={skill === s.id}
              className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-[15px] transition-colors ${
                skill === s.id ? "border-volt-deep bg-volt-soft font-semibold text-ink" : "border-line bg-paper text-ink/75 hover:border-ink/30"
              }`}
            >
              {s.label}
              {skill === s.id && <Check size={16} className="text-volt-deep" />}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={CalendarDays} step={3} title="When can you learn?" hint={`Pick as many as suit you — at least ${MIN_DAYS} days and ${MIN_TIMINGS} timings. More options = faster grouping (minimum ${PROGRAM.minGroupSize} players).`}>
        <div>
          <p className="label">Preferred days <span className="text-signal">*</span> <span className="font-normal normal-case tracking-normal text-ink/45">({days.length}/{MIN_DAYS}+ picked)</span></p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <Chip key={d} on={days.includes(d)} onClick={() => setDays((v) => toggle(v, d))}>{d.slice(0, 3)}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Preferred timings <span className="text-signal">*</span> <span className="font-normal normal-case tracking-normal text-ink/45">({timings.length}/{MIN_TIMINGS}+ picked)</span></p>
          <div className="flex flex-wrap gap-2">
            {TIMINGS.map((t) => (
              <Chip key={t} on={timings.includes(t)} onClick={() => setTimings((v) => toggle(v, t))}>
                <Clock size={13} className="opacity-50" /> {t}
              </Chip>
            ))}
          </div>
        </div>
      </Section>

      <Section icon={MapPin} step={4} title="Preferred venues" hint="Pick every venue that works for you. Monthly fee per person, 8 classes.">
        <div className="grid gap-3 sm:grid-cols-2">
          {VENUES.map((v) => {
            const on = venues.includes(v.id);
            const kidsBlocked = isKid && v.kids == null;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => pickVenue(v.id)}
                disabled={kidsBlocked}
                aria-pressed={on}
                className={`relative rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  on ? "border-volt-deep bg-volt-soft" : "border-line bg-paper hover:border-ink/30"
                }`}
              >
                {on && <Check size={16} className="absolute right-3 top-3 text-volt-deep" />}
                <p className="pr-6 font-semibold text-ink">{v.name}</p>
                <p className="text-xs text-ink/55">{v.area} · {v.timing}</p>
                <p className="mt-2 text-sm text-ink/75">
                  {v.kids != null ? <>Kids (U-16) <strong className="text-ink">{formatRupees(v.kids)}</strong> · </> : <span className="text-ink/50">Adults only · </span>}
                  Adults <strong className="text-ink">{formatRupees(v.adults)}</strong>
                </p>
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon={HeartPulse} step={5} title="Emergency & health">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="r-ephone">Emergency contact <span className="text-signal">*</span></label>
            <input id="r-ephone" className="field" type="tel" inputMode="numeric" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} required placeholder="Their mobile number" />
          </div>
          <div>
            <label className="label" htmlFor="r-erel">Relation with registrant <span className="text-signal">*</span></label>
            <input id="r-erel" className="field" value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)} required placeholder="e.g. Parent, Spouse, Friend" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="r-med">Any medical conditions</label>
            <textarea id="r-med" className="field min-h-[84px]" value={medical} onChange={(e) => setMedical(e.target.value.slice(0, 300))} placeholder="Injuries, asthma, allergies… leave blank if none" />
          </div>
        </div>
      </Section>

      <div className="card z-10 border-volt-deep/30 sm:sticky sm:bottom-3 p-5 shadow-[0_20px_50px_-25px_rgba(6,38,61,0.6)] sm:p-6">
        {venues.length > 1 && (
          <div className="mb-4">
            <label className="label" htmlFor="r-payvenue">Pay for</label>
            <select id="r-payvenue" className="field" value={chargeVenue} onChange={(e) => setPayVenue(e.target.value)}>
              {venues.map((id) => {
                const v = VENUES.find((x) => x.id === id)!;
                const f = feeFor(id, ageNum || 30);
                return (
                  <option key={id} value={id} disabled={f == null}>
                    {v.name} — {f == null ? "adults only" : formatRupees(f)}
                  </option>
                );
              })}
            </select>
            <p className="mt-1 text-[12px] text-ink/50">If we group you at a different venue, we&apos;ll adjust the difference.</p>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Monthly fee · {PROGRAM.classesPerMonth} classes</p>
            <p className="font-display text-3xl text-ink">{fee != null ? formatRupees(fee) : "—"}</p>
          </div>
          <p className="text-xs text-ink/55">Slot confirmed after payment &amp; grouping.</p>
        </div>
        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {razorpayEnabled && (
            <button type="submit" disabled={!!busy} className="btn-volt flex-1">
              {busy === "pay" ? <Spinner /> : null} {busy === "pay" ? "Opening payment…" : `Register & pay${fee != null ? ` ${formatRupees(fee)}` : ""}`}
            </button>
          )}
          <button type="button" disabled={!!busy} onClick={() => void submit(false)} className={razorpayEnabled ? "btn-outline flex-1" : "btn-volt flex-1"}>
            {busy === "later" ? <Spinner /> : null} {razorpayEnabled ? "Register now, pay after grouping" : "Register"}
          </button>
        </div>
      </div>
    </form>
  );
}
