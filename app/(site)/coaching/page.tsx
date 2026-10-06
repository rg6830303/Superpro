import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, MessageCircle, Trophy, Users } from "lucide-react";
import { CoachingFlow } from "@/components/coaching-flow";
import { getUserRow } from "@/lib/accounts";
import { getPlayerSession } from "@/lib/auth";
import { getCoachAvailability, getCoaches } from "@/lib/queries";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { waLink } from "@/lib/site";
import { COACH, PROGRAM, VENUES, currentBatch, formatRupees } from "@/lib/coaching-program";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coaching",
  description: `${PROGRAM.name} — beginner pickleball coaching with ${COACH.name} in Kolkata. ${PROGRAM.classesPerMonth} classes a month, small groups, private sessions available.`,
};

export default async function CoachingPage() {
  const [allCoaches, availability, session] = await Promise.all([
    getCoaches().catch(() => []),
    getCoachAvailability().catch(() => []),
    getPlayerSession(),
  ]);
  // The programme coach is booked through the group registration form, not the per-session flow.
  const coaches = allCoaches.filter((c) => c.slug !== COACH.slug);
  const profile = session ? await getUserRow(session.id) : null;
  const month = currentBatch().split(" ")[0];
  const fromPrice = Math.min(...VENUES.map((v) => v.kids ?? v.adults));

  return (
    <div className="wrap section">
      <p className="eyebrow">Coaching</p>
      <h1 className="mt-3 headline-page">Learn from someone better</h1>
      <p className="lede mt-4 max-w-2xl">
        Start with the basics in a small group, or book private sessions. Every class is run by a coach who&apos;s won
        on these courts.
      </p>

      {/* Featured programme */}
      <article className="mt-10 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
        <div className="grid lg:grid-cols-[minmax(0,22rem)_1fr]">
          <Link href={`/coaching/${COACH.slug}`} className="relative block aspect-[869/770] lg:aspect-auto">
            <Image src={COACH.image} alt={`Coach ${COACH.name}`} fill sizes="(min-width: 1024px) 22rem, 100vw" className="object-cover" priority />
            <span className="absolute left-3 top-3 rounded-pill bg-volt px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">
              {month} batch open
            </span>
          </Link>
          <div className="p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-volt-deep">{PROGRAM.name}</p>
            <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{PROGRAM.title}</h2>
            <p className="mt-1 text-ink/70">
              with <Link href={`/coaching/${COACH.slug}`} className="font-semibold text-ink hover:underline">{COACH.name}</Link>
            </p>
            <p className="mt-4 flex items-start gap-2 text-sm text-ink/75">
              <Trophy size={16} className="mt-0.5 shrink-0 text-volt-deep" /> {COACH.achievements[0]}
            </p>
            <div className="mt-5 grid gap-2 text-sm text-ink/75 sm:grid-cols-3">
              <span className="flex items-center gap-2"><CalendarDays size={15} className="text-volt-deep" /> {PROGRAM.classesPerMonth} classes / month</span>
              <span className="flex items-center gap-2"><Users size={15} className="text-volt-deep" /> Groups of {PROGRAM.minGroupSize}+</span>
              <span className="flex items-center gap-2"><MapPin size={15} className="text-volt-deep" /> {VENUES.length} venues</span>
            </div>
            <p className="mt-5 text-sm text-ink/60">
              From <strong className="font-display text-2xl text-ink">{formatRupees(fromPrice)}</strong> / month · all equipment provided
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/coaching/register" className="btn-volt">
                Register now <ArrowRight size={16} />
              </Link>
              <Link href={`/coaching/${COACH.slug}`} className="btn-outline">
                Coach &amp; programme details
              </Link>
            </div>
          </div>
        </div>
      </article>

      <section className="mt-12">
        <h2 className="headline-section">Private sessions</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          One-on-one coaching with {COACH.name} at a time and venue that suits you. Message us and we&apos;ll set it up.
        </p>
        <a
          href={waLink(`Hi! I'd like a private coaching session with ${COACH.name}.`, PROGRAM.phoneDigits)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline mt-4"
        >
          <MessageCircle size={15} /> Enquire on WhatsApp
        </a>
      </section>

      {coaches.length > 0 && (
        <section className="mt-14">
          <h2 className="headline-section">More coaches</h2>
          <div className="mt-6">
            <CoachingFlow
              coaches={coaches}
              availability={availability}
              razorpayEnabled={isRazorpayEnabled}
              razorpayKeyId={razorpayKeyId}
              player={
                profile
                  ? { name: profile.full_name, phone: profile.phone ?? "", email: profile.email, skill: profile.skill_level }
                  : null
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}
