import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About & vision",
  description:
    "Why SuperPro exists: gear built for Indian conditions, a game every day in Kolkata, and a coaching path that takes a first-timer to a tournament draw.",
};

const PILLARS = [
  {
    title: "Equipment you can trust",
    body: "We stopped importing paddles that cracked in a Kolkata August. The Champion Series is specced for heat and humidity first — thermoformed unibody construction, seam-welded balls, grips that stay tacky at 80% humidity.",
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
    body: "We run our own draws and sponsor the ones we don't. Prize money is published, formats are published, results are published. That is the whole standard.",
  },
];

const TIMELINE = [
  { year: "2024", title: "First paddles", body: "Champion Series prototypes tested through a full monsoon at TurfXL." },
  { year: "2025", title: "Daily games", body: "Open play goes seven days a week across two Kolkata venues." },
  { year: "2026", title: "The circuit", body: "Legends & Challengers reaches a third edition; SuperPro becomes paddle partner for the Bengal Open." },
  { year: "Next", title: "The academy", body: "A permanent SuperPro court with a junior programme and full-time coaching staff." },
];

export default function AboutPage() {
  return (
    <>
      {/* Statement opener: one sentence, set large, with room around it. */}
      <section className="border-b border-line">
        <div className="wrap py-16 lg:py-24">
          <p className="eyebrow">About {SITE.name}</p>
          <h1 className="mt-6 max-w-4xl text-[clamp(2.25rem,5.6vw,4.25rem)] leading-[1.02]">
            We built the club we wanted to play at.
          </h1>
          <p className="lede mt-8 max-w-2xl">
            SuperPro began with three players, one net and a shared complaint: Kolkata had people who wanted to
            play pickleball and nothing built for them. No paddles that lasted a season, no game you could
            simply turn up to, no honest answer about which coach to learn from. So we made the gear, then the
            games, then the coaching — in that order, because that is the order players need them.
          </p>
        </div>
      </section>

      {/* Vision — a two-column read, product image anchoring the left rail. */}
      <section className="wrap py-20">
        <div className="grid min-w-0 gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal variant="left">
            <div className="lg:sticky lg:top-28">
              <h2 className="rule-head text-4xl sm:text-5xl">Our vision</h2>
              <p className="mt-6 text-xl leading-[1.4] text-ink">
                Make Kolkata the easiest city in India to start playing pickleball — and the hardest one to
                stop.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-ink/65">
                Every decision is measured against one question: does this get another person onto a court this
                week, and keep the ones already there improving? Gear, games, coaching and tournaments are the
                four levers we pull.
              </p>
              <div className="mt-8 overflow-hidden rounded-card border border-line bg-mist">
                <div className="relative aspect-[4/3]">
                  <Image
                    src="/products/paddle-champion-t700.png"
                    alt="SuperPro Champion Series T700 paddle"
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-contain p-8"
                  />
                </div>
              </div>
            </div>
          </Reveal>

          {/* Prose blocks separated by rules rather than boxed in numbered cards. */}
          <div className="divide-y divide-line border-y border-line">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 70}>
                <div className="py-8">
                  <h3 className="text-2xl">{p.title}</h3>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink/70">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline as an actual horizontal track, marked on a line. */}
      <section className="border-y border-line bg-mist py-20">
        <div className="wrap">
          <Reveal>
            <h2 className="rule-head text-4xl sm:text-5xl">How we got here</h2>
          </Reveal>

          <div className="scroll-x mt-12 pb-2">
            <div className="relative flex min-w-[720px] gap-6">
              <span aria-hidden className="absolute left-0 right-0 top-[7px] h-[2px] bg-line-strong" />
              {TIMELINE.map((t, i) => (
                <Reveal key={t.year} delay={i * 90} className="flex-1">
                  <div className="relative">
                    <span
                      className={`relative z-10 block h-4 w-4 rounded-full border-4 border-mist ${
                        t.year === "Next" ? "bg-line-strong" : "bg-volt"
                      }`}
                    />
                    <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-volt-deep">
                      {t.year}
                    </p>
                    <p className="mt-2 font-display text-xl text-ink">{t.title}</p>
                    <p className="mt-2 max-w-[15rem] text-sm leading-relaxed text-ink/65">{t.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Close on the one thing a reader here would actually want next. */}
      <section className="wrap py-20">
        <Reveal>
          <div className="flex flex-col gap-6 border-t-2 border-ink pt-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl sm:text-4xl">Bring shoes. We&apos;ll lend you a paddle.</h2>
              <p className="mt-3 max-w-md text-sm text-ink/65">
                Open games run every morning and evening across two venues.
              </p>
            </div>
            <Link href="/games" className="btn-volt shrink-0">
              See this week&apos;s slots <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
