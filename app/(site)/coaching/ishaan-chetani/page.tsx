import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Crosshair,
  GraduationCap,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";
import { Reveal } from "@/components/motion";
import { COACH, CURRICULUM, HIGHLIGHTS, PROGRAM, VENUES, currentBatch, formatRupees } from "@/lib/coaching-program";
import { waLink } from "@/lib/site";

export const metadata: Metadata = {
  title: `${COACH.name} · Beginner pickleball coaching`,
  description: `${PROGRAM.name}: beginner pickleball coaching with ${COACH.name} in Kolkata — ${PROGRAM.classesPerMonth} classes a month, small groups, private sessions available. ${COACH.achievements[0]}.`,
  openGraph: { images: [COACH.poster] },
};

const FACTS = [
  { icon: CalendarDays, title: `${PROGRAM.classesPerMonth} classes a month`, body: "Monthly batches with flexible slots." },
  { icon: Users, title: `Minimum ${PROGRAM.minGroupSize} players`, body: "Needed to form a group — small and personal." },
  { icon: MapPin, title: "Different venues", body: `${VENUES.length} venues across Kolkata to choose from.` },
  { icon: GraduationCap, title: "Private sessions", body: "One-on-one coaching is also available." },
];

const PILLARS = [
  { icon: Crosshair, label: "Focus" },
  { icon: GraduationCap, label: "Learn" },
  { icon: TrendingUp, label: "Improve" },
];

export default function IshaanChetaniPage() {
  const month = currentBatch().split(" ")[0];
  return (
    <>
      {/* Hero */}
      <section className="band-ink relative overflow-hidden">
        <div aria-hidden className="aura aura-volt -right-24 -top-24 h-80 w-80" />
        <div className="wrap relative grid gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-20">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-pill bg-volt px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink">
              {month} batch now open
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-volt">{PROGRAM.name}</p>
            <h1 className="mt-3 font-display text-[clamp(2.6rem,7vw,4.6rem)] font-black uppercase leading-[0.92] text-paper">
              Beginner <span className="text-volt">pickleball</span> coaching
            </h1>
            <p className="mt-5 text-xl font-semibold text-paper/85">{PROGRAM.tagline}</p>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-paper/65">
              New to pickleball? This is your sign to start. Small groups, personalised coaching, and every piece of
              equipment provided — no experience needed.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/coaching/register" className="btn-volt">
                Register for the {month} batch <ArrowRight size={16} />
              </Link>
              <a href={`tel:+${PROGRAM.phoneDigits}`} className="inline-flex items-center justify-center gap-2 rounded-pill border border-paper/30 px-6 py-3 text-sm font-semibold text-paper hover:border-volt hover:text-volt">
                <Phone size={15} /> {PROGRAM.phoneDisplay}
              </a>
            </div>
          </div>

          <Reveal>
            <div className="relative mx-auto w-full max-w-md">
              <div className="overflow-hidden rounded-2xl border border-paper/15 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
                <Image
                  src={COACH.image}
                  alt={`Coach ${COACH.name} on court at Ballygunge Arena`}
                  width={869}
                  height={770}
                  priority
                  sizes="(min-width: 1024px) 28rem, 100vw"
                  className="h-auto w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-5 left-4 right-4 rounded-xl bg-paper p-4 shadow-xl sm:left-auto sm:right-[-1rem] sm:w-72">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Head coach</p>
                <p className="font-display text-2xl text-ink">{COACH.name}</p>
                <p className="mt-1 flex items-start gap-2 text-sm text-ink/75">
                  <Trophy size={15} className="mt-0.5 shrink-0 text-volt-deep" /> {COACH.achievements[0]}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Facts */}
      <section className="wrap section pt-16">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FACTS.map((f, i) => (
            <Reveal key={f.title} delay={i * 50}>
              <div className="card h-full p-5">
                <f.icon size={20} className="text-volt-deep" />
                <p className="mt-3 font-display text-lg leading-tight text-ink sm:text-xl">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink/60 sm:text-sm">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* About + achievements */}
      <section className="wrap section border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="eyebrow">About the coach</p>
            <h2 className="mt-3 headline-section">{COACH.name}</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/70">{COACH.bio}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {COACH.specialties.map((s) => (
                <span key={s} className="chip">{s}</span>
              ))}
            </div>
            <div className="mt-8 flex gap-6">
              {PILLARS.map((p) => (
                <div key={p.label} className="flex flex-col items-center gap-2">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-volt-soft text-volt-deep">
                    <p.icon size={20} />
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/70">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card self-start p-6">
            <p className="eyebrow">Achievements</p>
            <ul className="mt-4 space-y-3">
              {COACH.achievements.map((a) => (
                <li key={a} className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-volt text-ink">
                    <Trophy size={18} />
                  </span>
                  <p className="pt-1.5 font-semibold leading-snug text-ink">{a}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Curriculum + highlights */}
      <section className="wrap section border-t border-line">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">What you&apos;ll learn</p>
            <h2 className="mt-3 headline-section">The basics, done properly</h2>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {CURRICULUM.map((c, i) => (
                <div key={c} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
                  <span className="font-mono text-xs text-volt-deep">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-semibold text-ink">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">Why join</p>
            <ul className="mt-6 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-3 text-[15px] text-ink/80">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-volt-soft text-volt-deep">
                    <Check size={14} />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Venues & fees */}
      <section className="wrap section border-t border-line">
        <p className="eyebrow">Venues &amp; fees</p>
        <h2 className="mt-3 headline-section">Pick the court closest to you</h2>
        <p className="mt-2 text-sm text-ink/60">Per person, per month · {PROGRAM.classesPerMonth} classes · kids rate for under-16s.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {VENUES.map((v) => (
            <div key={v.id} className="card flex flex-col p-5">
              <p className="font-semibold text-ink">{v.name}</p>
              <p className="text-xs text-ink/55">{v.area}</p>
              <p className="mt-3 text-xs text-ink/60">{v.timing}</p>
              <div className="mt-4 flex items-end gap-4 border-t border-line pt-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">Adults</p>
                  <p className="font-display text-2xl text-ink">{formatRupees(v.adults)}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">Kids U-16</p>
                  <p className="font-display text-2xl text-ink">{v.kids != null ? formatRupees(v.kids) : "—"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Poster + CTA */}
      <section className="wrap section border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-center">
          <Reveal>
            <a href={COACH.poster} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-line shadow-card">
              <Image
                src={COACH.poster}
                alt={`${PROGRAM.name} beginner coaching poster with ${COACH.name}`}
                width={1054}
                height={1492}
                sizes="(min-width: 1024px) 26rem, 100vw"
                className="h-auto w-full"
              />
            </a>
          </Reveal>
          <div>
            <p className="eyebrow">Ready to start?</p>
            <h2 className="mt-3 headline-section">The {month} batch is open</h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink/70">
              Tell us your level, the days and times that suit you and your preferred venues. We group players of the same
              level (minimum {PROGRAM.minGroupSize}) and confirm your slot once you&apos;ve paid.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/coaching/register" className="btn-volt">
                Register now <ArrowRight size={16} />
              </Link>
              <a href={waLink(`Hi! I'd like to join ${PROGRAM.name} coaching.`, PROGRAM.phoneDigits)} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={PROGRAM.instagram} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <Instagram size={16} /> @{PROGRAM.instagramHandle}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
