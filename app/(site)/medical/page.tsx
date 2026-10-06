import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  Bone,
  Clock,
  Dumbbell,
  HeartPulse,
  MessageCircle,
  Phone,
  ShieldCheck,
  Snowflake,
  Stethoscope,
} from "lucide-react";
import { Reveal } from "@/components/motion";
import { MedicalSlideshow, type SlideshowImage } from "@/components/medical-slideshow";
import { SITE, waLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Medical Assistance",
  description:
    "On-court injury support, stretching and recovery at Sparvic sessions — Doctor Pickle, Avishek Kar. Call or WhatsApp +91 91631 12544.",
};

const DOCTOR = {
  handle: "Doctor Pickle",
  name: "Avishek Kar",
  phoneDisplay: "+91 91631 12544",
  phoneDigits: "919163112544",
};

const IMAGES: SlideshowImage[] = [
  { src: "/medical/medical-01.jpg", alt: "On-court assessment after a fall" },
  { src: "/medical/medical-02.jpg", alt: "Leg stretch and recovery session courtside" },
  { src: "/medical/medical-05.jpg", alt: "Hamstring stretch during a break in play" },
  { src: "/medical/medical-03.jpg", alt: "Cool-down stretch after a long rally" },
  { src: "/medical/medical-04.jpg", alt: "Shoulder and back mobility work between games" },
  { src: "/medical/medical-06.jpg", alt: "Back on the court after treatment" },
];

const SERVICES = [
  { icon: Stethoscope, title: "On-court first response", body: "Assessed where it happened — falls, knocks and anything that stops play mid-rally." },
  { icon: Bone, title: "Sprains & strains", body: "Ankles, wrists, calves and knees: the injuries pickleball's quick lateral steps tend to cause." },
  { icon: Snowflake, title: "Immediate care", body: "Ice, compression and support straight away, so a minor tweak stays minor." },
  { icon: Activity, title: "Stretch & mobility", body: "Guided stretching for tight hamstrings, hips, shoulders and lower back between games." },
  { icon: HeartPulse, title: "Recovery after play", body: "Cool-down and recovery advice after long sessions or back-to-back games." },
  { icon: ShieldCheck, title: "Injury prevention", body: "Advice before you play if you're returning from an injury or carrying a niggle." },
];

const URGENT = [
  "You can't put weight on a foot or ankle",
  "Visible swelling or a joint looks out of place",
  "A fall onto the head, wrist or elbow",
  "Dizziness, chest pain or trouble breathing",
];

const AHEAD = [
  "An old injury you want checked before playing",
  "Persistent stiffness or soreness after games",
  "Help with a warm-up or stretching routine",
  "Coming back after time off or recent surgery",
];

const WARMUP = [
  { step: "Light cardio", time: "3 min", body: "Brisk walk or easy jog around the court to raise your heart rate." },
  { step: "Dynamic stretches", time: "3 min", body: "Leg swings, hip circles, arm circles and walking lunges." },
  { step: "Footwork", time: "2 min", body: "Side shuffles and split steps — the movements you'll make in play." },
  { step: "Easy dinks", time: "2 min", body: "Soft rallies at the kitchen line before any hard shots." },
];

const FAQ = [
  {
    q: "When is Doctor Pickle at the courts?",
    a: `On site during ${SITE.name} sessions for on-court injury support. For anything planned, message ahead so he knows to expect you.`,
  },
  {
    q: "Does he replace a hospital or my own doctor?",
    a: "No. He provides first response and on-court care. For a serious injury, he'll help you get to the right medical care quickly — in an emergency, call 112.",
  },
  {
    q: "Can I get a stretch or warm-up check even if I'm not injured?",
    a: "Yes — prevention is a big part of it. Ask for a quick check before you play, especially if something feels tight.",
  },
  {
    q: "How do I reach him?",
    a: `Call or WhatsApp ${DOCTOR.phoneDisplay}. WhatsApp is best for anything that isn't urgent.`,
  },
];

export default function MedicalAssistancePage() {
  const whatsapp = waLink("Hi Avishek, I'd like some help with an injury / a stretch check before I play.", DOCTOR.phoneDigits);
  return (
    <>
      <section className="border-b border-line">
        <div className="wrap section">
          <p className="eyebrow">Medical Assistance</p>
          <h1 className="mt-6 max-w-3xl headline-page">Doctor Pickle is on the court.</h1>
          <p className="lede mt-8 max-w-2xl">
            Twisted an ankle mid-rally, pulled up short on a lunge, or just need a stretch talked through before you play
            — Avishek is the person to call. On site at {SITE.name} sessions for exactly this.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={`tel:+${DOCTOR.phoneDigits}`} className="btn-volt">
              <Phone size={16} /> Call {DOCTOR.phoneDisplay}
            </a>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-outline">
              <MessageCircle size={16} /> WhatsApp
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
              <p className="eyebrow">Your on-court physio</p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45">{DOCTOR.handle}</p>
              <h2 className="mt-1 font-display text-3xl text-ink">{DOCTOR.name}</h2>
              <p className="mt-4 font-mono text-lg tabular-nums text-ink">{DOCTOR.phoneDisplay}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`tel:+${DOCTOR.phoneDigits}`} className="btn-volt">
                  <Phone size={16} /> Call now
                </a>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-outline">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>

              <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm text-ink/70">
                <li className="flex items-start gap-2"><Clock size={15} className="mt-0.5 shrink-0 text-volt-deep" /> On site during {SITE.name} sessions</li>
                <li className="flex items-start gap-2"><MessageCircle size={15} className="mt-0.5 shrink-0 text-volt-deep" /> Message ahead for anything that isn&apos;t urgent</li>
                <li className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-signal" /> Emergency? Call 112 first</li>
              </ul>
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

      <section className="wrap section border-t border-line">
        <h2 className="headline-section">When to reach out</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-signal/30 bg-signal/5 p-6">
            <p className="flex items-center gap-2 font-semibold text-signal"><AlertTriangle size={17} /> Stop playing and call right away</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/80">
              {URGENT.map((u) => <li key={u} className="flex gap-2"><span className="text-signal">•</span>{u}</li>)}
            </ul>
            <a href={`tel:+${DOCTOR.phoneDigits}`} className="btn-volt mt-5 w-full sm:w-auto"><Phone size={15} /> Call Avishek</a>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-6">
            <p className="flex items-center gap-2 font-semibold text-ink"><MessageCircle size={17} className="text-volt-deep" /> Message ahead</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/80">
              {AHEAD.map((u) => <li key={u} className="flex gap-2"><span className="text-volt-deep">•</span>{u}</li>)}
            </ul>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-outline mt-5 w-full sm:w-auto"><MessageCircle size={15} /> WhatsApp</a>
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

      {/* Phones: the number is always one tap away. */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          <a href={`tel:+${DOCTOR.phoneDigits}`} className="btn-volt flex-1"><Phone size={15} /> Call Doctor Pickle</a>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp Doctor Pickle" className="btn-outline px-4"><MessageCircle size={16} /></a>
        </div>
      </div>
    </>
  );
}
