import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  Bone,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Dumbbell,
  HeartPulse,
  MessageCircle,
  Phone,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Reveal } from "@/components/motion";
import { MedicalSlideshow, type SlideshowImage } from "@/components/medical-slideshow";
import { DoctorBookingForm } from "@/components/doctor-booking-form";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
import { ageFrom } from "@/lib/profile";
import { isRazorpayEnabled } from "@/lib/razorpay";
import { CONCERNS, DOCTOR, SLOTS } from "@/lib/doctor";
import { waLink } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Medical Assistance",
  description: `Book a clinic consultation with ${DOCTOR.handle} (${DOCTOR.name}) for pickleball injuries, pain and recovery — ₹${DOCTOR.fee}, booked and paid online.`,
};

const IMAGES: SlideshowImage[] = [
  { src: "/medical/medical-01.jpg", alt: "Assessment after a fall" },
  { src: "/medical/medical-02.jpg", alt: "Leg stretch and recovery work" },
  { src: "/medical/medical-05.jpg", alt: "Hamstring stretch" },
  { src: "/medical/medical-03.jpg", alt: "Cool-down stretch after a long rally" },
  { src: "/medical/medical-04.jpg", alt: "Shoulder and back mobility work" },
  { src: "/medical/medical-06.jpg", alt: "Back to playing after treatment" },
];

const SERVICES = [
  { icon: Stethoscope, title: "Injury assessment", body: "A proper look at what's hurting — how it happened, what's affected and what to do next." },
  { icon: Bone, title: "Sprains & strains", body: "Ankles, wrists, calves and knees: the injuries pickleball's quick lateral steps tend to cause." },
  { icon: Activity, title: "Pain & mobility", body: "Knee, shoulder, elbow and back pain, plus stiffness that limits your movement." },
  { icon: HeartPulse, title: "Recovery plans", body: "A step-by-step plan to get you back to playing safely after an injury." },
  { icon: Dumbbell, title: "Stretching & strength", body: "Exercises for tight hamstrings, hips, shoulders and lower back that you can do at home." },
  { icon: ShieldCheck, title: "Injury prevention", body: "A check before you play if you're returning from an injury or carrying a niggle." },
];

const STEPS = [
  { icon: ClipboardList, title: "Book online", body: "Tell us what's wrong and pick a preferred day and time." },
  { icon: CreditCard, title: `Pay ₹${DOCTOR.fee}`, body: "Securely through Razorpay — UPI, cards or netbanking." },
  { icon: CalendarCheck, title: "Get confirmed", body: `${DOCTOR.handle} confirms your exact time and the clinic location on WhatsApp.` },
];

const URGENT = [
  "You can't put weight on a foot or ankle",
  "A joint looks out of place, or there's severe swelling",
  "You hit your head, or have dizziness or chest pain",
  "Trouble breathing",
];

const BOOK_FOR = [
  "An injury or pain that isn't going away",
  "Persistent stiffness or soreness after games",
  "Returning after time off or recent surgery",
  "A stretching or strengthening routine for your game",
];

const WARMUP = [
  { step: "Light cardio", time: "3 min", body: "Brisk walk or easy jog to raise your heart rate." },
  { step: "Dynamic stretches", time: "3 min", body: "Leg swings, hip circles, arm circles and walking lunges." },
  { step: "Footwork", time: "2 min", body: "Side shuffles and split steps — the movements you'll make in play." },
  { step: "Easy dinks", time: "2 min", body: "Soft rallies at the kitchen line before any hard shots." },
];

const FAQ = [
  { q: "How much does a consultation cost?", a: `₹${DOCTOR.fee} per clinic visit, paid online when you book.` },
  { q: "Where is the clinic and what time is my appointment?", a: `After you book, ${DOCTOR.handle} confirms your exact time and shares the clinic location on WhatsApp.` },
  { q: "Can I book without paying straight away?", a: `Yes — choose "Request now, pay later". Your request is saved and you can pay from your booking link. The appointment is confirmed once paid.` },
  { q: "Is this for emergencies?", a: "No. For a serious injury or a medical emergency, call 112 or go to the nearest hospital." },
];

export default async function MedicalAssistancePage() {
  const session = await getPlayerSession();
  const profile = session ? await getUserRow(session.id).catch(() => null) : null;
  const age = profile?.date_of_birth ? ageFrom(profile.date_of_birth) : null;
  const prefill = profile
    ? {
        name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        age: age != null ? String(age) : "",
        gender: profile.gender === "male" ? "Male" : profile.gender === "female" ? "Female" : "",
      }
    : null;
  const whatsapp = waLink(`Hi ${DOCTOR.name}, I'd like to book a consultation.`, DOCTOR.phoneDigits);

  return (
    <>
      <section className="border-b border-line">
        <div className="wrap section">
          <p className="eyebrow">Medical Assistance</p>
          <h1 className="mt-6 max-w-3xl headline-page">Get back to playing, properly.</h1>
          <p className="lede mt-8 max-w-2xl">
            Twisted an ankle, a knee that won&apos;t settle, or a shoulder that aches after every game? Book a clinic consultation
            with {DOCTOR.handle} — {DOCTOR.name} — for pickleball injuries, pain and recovery.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#book" className="btn-volt">
              <CalendarCheck size={16} /> Book a consultation · ₹{DOCTOR.fee}
            </a>
            <a href={`tel:+${DOCTOR.phoneDigits}`} className="btn-outline">
              <Phone size={16} /> {DOCTOR.phoneDisplay}
            </a>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <Reveal>
            <MedicalSlideshow images={IMAGES} />
          </Reveal>
          <Reveal delay={80}>
            <div className="card p-6 sm:p-8">
              <p className="eyebrow">Sports physio</p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45">{DOCTOR.handle}</p>
              <h2 className="mt-1 font-display text-3xl text-ink">{DOCTOR.name}</h2>
              <p className="mt-4 font-mono text-lg tabular-nums text-ink">{DOCTOR.phoneDisplay}</p>
              <div className="mt-5 rounded-xl bg-volt-soft px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-volt-deep">Clinic visit</p>
                <p className="font-display text-2xl text-ink">₹{DOCTOR.fee} <span className="text-sm font-normal text-ink/60">per consultation</span></p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#book" className="btn-volt"><CalendarCheck size={16} /> Book now</a>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-outline"><MessageCircle size={16} /> WhatsApp</a>
              </div>
              <p className="mt-6 flex items-start gap-2 border-t border-line pt-5 text-sm text-ink/70">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-signal" /> Emergency? Call 112 — don&apos;t wait for an appointment.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="wrap section border-t border-line">
        <p className="eyebrow">Services</p>
        <h2 className="mt-3 headline-section">What he helps with</h2>
        <div className="mt-8 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((item, i) => (
            <Reveal key={item.title} delay={i * 50}>
              <div className="card flex h-full gap-4 p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-volt-soft text-volt-deep">
                  <item.icon size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-ink">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink/65">{item.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="book" className="wrap section scroll-mt-24 border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,36rem)] lg:items-start">
          <div>
            <p className="eyebrow">Book a consultation</p>
            <h2 className="mt-3 headline-section">₹{DOCTOR.fee} clinic visit</h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink/70">
              Book and pay here. No calls needed — you&apos;ll get a confirmation by email and WhatsApp.
            </p>
            <ol className="mt-8 space-y-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-volt text-ink"><s.icon size={18} /></span>
                  <div>
                    <p className="font-semibold text-ink"><span className="font-mono text-xs text-ink/45">{i + 1}.</span> {s.title}</p>
                    <p className="text-sm text-ink/65">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <DoctorBookingForm fee={DOCTOR.fee} doctorHandle={DOCTOR.handle} concerns={CONCERNS} slots={SLOTS} razorpayEnabled={isRazorpayEnabled} prefill={prefill} />
        </div>
      </section>

      <section className="wrap section border-t border-line">
        <h2 className="headline-section">Book, or get urgent help?</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-signal/30 bg-signal/5 p-6">
            <p className="flex items-center gap-2 font-semibold text-signal"><AlertTriangle size={17} /> Don&apos;t wait — call 112 or go to a hospital</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/80">
              {URGENT.map((u) => <li key={u} className="flex gap-2"><span className="text-signal">•</span>{u}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-6">
            <p className="flex items-center gap-2 font-semibold text-ink"><CalendarCheck size={17} className="text-volt-deep" /> Book a consultation for</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/80">
              {BOOK_FOR.map((u) => <li key={u} className="flex gap-2"><span className="text-volt-deep">•</span>{u}</li>)}
            </ul>
            <a href="#book" className="btn-volt mt-5 w-full sm:w-auto"><CalendarCheck size={15} /> Book · ₹{DOCTOR.fee}</a>
          </div>
        </div>
      </section>

      <section className="wrap section border-t border-line">
        <p className="eyebrow">Before you play</p>
        <h2 className="mt-3 headline-section">A 10-minute warm-up</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">Most pickleball injuries happen to cold muscles in the first few games. This routine helps.</p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WARMUP.map((w, i) => (
            <li key={w.step} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-volt-deep">{String(i + 1).padStart(2, "0")}</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink/50"><Dumbbell size={12} /> {w.time}</span>
              </div>
              <p className="mt-3 font-display text-lg text-ink">{w.step}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/65">{w.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap section border-t border-line">
        <h2 className="headline-section">Questions</h2>
        <div className="mt-6 max-w-3xl divide-y divide-line rounded-2xl border border-line bg-paper">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                {f.q}
                <span className="text-xl leading-none text-ink/40 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Phones: booking is always one tap away. */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          <a href="#book" className="btn-volt flex-1"><CalendarCheck size={15} /> Book consultation · ₹{DOCTOR.fee}</a>
          <a href={`tel:+${DOCTOR.phoneDigits}`} aria-label={`Call ${DOCTOR.handle}`} className="btn-outline px-4"><Phone size={16} /></a>
        </div>
      </div>
    </>
  );
}
