import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle, Target } from "lucide-react";
import { Reveal, SectionHeading } from "@/components/ui";
import { SITE, waLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "About & vision",
  description:
    "Why SuperPro exists: gear built for Indian conditions, a game every day in Kolkata, and a coaching path that takes a first-timer to a tournament draw.",
};

const PILLARS = [
  {
    title: "Equipment you can trust",
    body: "We stopped importing paddles that cracked in a Kolkata August. The Champion Series is specced for heat and humidity first — thermoformed unibody construction, seam-welded balls, grips that stay tacky in 80% humidity.",
  },
  {
    title: "Access before ambition",
    body: "A sport grows when anyone can play tomorrow morning. Daily open games, one flat price, no membership, no annual fee, and a WhatsApp group where your court and your partners are posted before you leave home.",
  },
  {
    title: "Coaching as a ladder",
    body: "Every coach on our roster owns a rung: first paddle, first rally, first competitive match, first DUPR rating. You should never have to guess who to learn from next.",
  },
  {
    title: "Competition that counts",
    body: "We run our own draws and sponsor the ones we don't. Prize money is published, formats are published, results are published. That's the whole standard.",
  },
];

const TIMELINE = [
  { year: "2024", title: "First paddles", body: "Champion Series prototypes tested through a full monsoon at TurfXL." },
  { year: "2025", title: "Daily games", body: "Open play goes seven days a week across two Kolkata venues." },
  { year: "2026", title: "The circuit", body: "Legends & Challengers reaches its third edition; SuperPro becomes paddle partner for the Bengal Open." },
  { year: "Next", title: "The academy", body: "A permanent SuperPro court with a junior programme and a full-time coaching staff." },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="court-lines absolute inset-0" aria-hidden />
        <div className="wrap relative py-16 lg:py-20">
          <p className="eyebrow">About {SITE.name}</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.5rem,7vw,4.5rem)]">
            We built the club we wanted to play at.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-bone/60">
            SuperPro began with three players, one net and a shared complaint: Kolkata had people who wanted
            to play pickleball and nothing built for them. No paddles that lasted a season, no game you could
            simply turn up to, no honest answer about which coach to learn from. So we made the gear, then the
            games, then the coaching — in that order, because that is the order players actually need them.
          </p>
        </div>
      </section>

      {/* Vision */}
      <section className="wrap py-20">
        <div className="grid min-w-0 gap-12 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <Target size={24} className="text-gold" />
              <h2 className="mt-4 text-4xl sm:text-5xl">Our vision</h2>
              <p className="mt-5 text-lg leading-relaxed text-bone/70">
                Make Kolkata the easiest city in India to start playing pickleball — and the hardest one to
                stop.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-bone/50">
                Every decision we make is measured against one question: does this get another person onto a
                court this week, and keep the ones already there improving? Gear, games, coaching and
                tournaments are just the four levers we pull.
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl bg-bone">
                <div className="relative aspect-[4/3]">
                  <Image
                    src="/products/paddle-champion-t700.png"
                    alt="SuperPro Champion Series T700 paddle"
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-contain p-6"
                  />
                </div>
              </div>
            </div>
          </Reveal>

          <div className="space-y-4">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="card p-7">
                  <div className="flex items-baseline gap-4">
                    <span className="font-display text-3xl text-gold">0{i + 1}</span>
                    <h3 className="text-2xl">{p.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-bone/55">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="border-y border-white/10 bg-ink-800/40 py-20">
        <div className="wrap">
          <Reveal>
            <SectionHeading eyebrow="The road so far" title="How we got here" />
          </Reveal>
          <div className="grid gap-5 md:grid-cols-4">
            {TIMELINE.map((t, i) => (
              <Reveal key={t.year} delay={i * 80}>
                <div className="card h-full p-6">
                  <p className="font-display text-4xl text-gold">{t.year}</p>
                  <p className="mt-3 font-display text-xl uppercase text-bone">{t.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-bone/50">{t.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap py-20">
        <div className="card flex flex-col items-center gap-5 px-6 py-14 text-center">
          <h2 className="text-4xl">Come play with us</h2>
          <p className="max-w-lg text-sm leading-relaxed text-bone/55">
            Open games run every morning and evening. Bring shoes — we&apos;ll lend you a paddle for your
            first session.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/games" className="btn-gold">
              Book a slot <ArrowRight size={16} />
            </Link>
            <a
              href={waLink(`Hi ${SITE.name}! I'd like to know more about the club.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              <MessageCircle size={16} /> Talk to a rep
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
