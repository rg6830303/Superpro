import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MessageCircle, Trophy, Users } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Reveal, SectionHeading } from "@/components/ui";
import { getAnnouncements, getCoaches, getFeaturedProducts, getTournaments, getWeekSessions } from "@/lib/queries";
import { formatDate, formatDateRange, formatTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { PRODUCT_CATEGORIES, SITE, waLink } from "@/lib/site";

export const dynamic = "force-dynamic";

const MARQUEE = [
  "Toray T700 carbon",
  "Daily open play",
  "DUPR-rated coaches",
  "Kolkata built",
  "Tournament ready",
  "Champion Series",
];

export default async function HomePage() {
  const [featured, sessions, tournaments, coaches, announcements] = await Promise.all([
    getFeaturedProducts(4),
    getWeekSessions(7),
    getTournaments(),
    getCoaches(),
    getAnnouncements(1),
  ]);

  const openSessions = sessions.filter((s) => (s.booked ?? 0) < s.capacity);
  const nextSessions = openSessions.slice(0, 4);
  const liveTournament = tournaments.find((t) => t.status === "open") ?? tournaments[0];
  const notice = announcements[0];

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="court-lines absolute inset-0" aria-hidden />
        <div className="wrap relative grid items-center gap-10 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow animate-fade-up">Kolkata · Est. 2024</p>
            <h1 className="mt-4 animate-fade-up text-[clamp(3rem,9vw,5.75rem)] leading-[0.88]">
              Pickleball,
              <br />
              played <span className="text-gold">properly.</span>
            </h1>
            <p className="mt-6 max-w-lg animate-fade-up text-base leading-relaxed text-bone/60">
              Champion Series paddles, balls and grips. Open games every morning and evening.
              Coaches who actually rebuild your third shot. And the tournaments the city turns up for.
            </p>
            <div className="mt-8 flex animate-fade-up flex-wrap gap-3">
              <Link href="/games" className="btn-gold">
                Book today&apos;s game <ArrowRight size={16} />
              </Link>
              <Link href="/products" className="btn-outline">
                Shop the Champion Series
              </Link>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-7">
              {[
                { k: openSessions.length ? `${openSessions.length}` : "—", v: "Open slots this week" },
                { k: coaches.length ? `${coaches.length}` : "—", v: "Certified coaches" },
                { k: `${tournaments.length || 4}`, v: "Tournaments run" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-4xl text-gold">{s.k}</dt>
                  <dd className="mt-1 text-[11px] uppercase tracking-wider text-bone/45">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-bone shadow-card">
              <Image
                src="/products/paddle-ball-hero.png"
                alt="SuperPro Champion Series paddle and outdoor ball"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-5 rounded-2xl border border-white/10 bg-ink px-5 py-4 shadow-lift">
              <p className="text-[11px] uppercase tracking-wider text-bone/45">Champion Series</p>
              <p className="font-display text-2xl text-bone">T700 · 16mm</p>
              <p className="mt-0.5 text-sm text-gold">{formatPaise(900000)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden border-b border-white/10 bg-ink-800/60 py-3">
        <div className="flex w-max animate-marquee gap-8">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="flex items-center gap-8 whitespace-nowrap font-display text-sm uppercase tracking-wider2 text-bone/35">
              {item}
              <span className="h-1 w-1 rounded-full bg-gold" />
            </span>
          ))}
        </div>
      </div>

      {notice && (
        <div className="wrap pt-8">
          <Link
            href={notice.link_url ?? "/tournaments"}
            className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/[0.07] px-5 py-4 transition-colors hover:border-gold/60"
          >
            <span className="chip-gold shrink-0">{notice.kind}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-bone">{notice.title}</span>
              <span className="block truncate text-xs text-bone/50">{notice.body}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-gold" />
          </Link>
        </div>
      )}

      {/* ── Vision ────────────────────────────────────────────────────── */}
      <section className="wrap py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Who we are"
            title="A pickleball house, not a shop"
            sub="SuperPro started because Kolkata had players and no infrastructure — no gear you could trust, no games you could just turn up to, no coaching pathway. We built all three, in that order."
            action={
              <Link href="/about" className="btn-outline btn-sm shrink-0">
                Our vision <ArrowRight size={14} />
              </Link>
            }
          />
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Gear that survives here",
              d: "Every paddle and ball is tested through a Kolkata summer before it gets the SuperPro mark. Humidity, turf, and three-hour evening sessions.",
            },
            {
              n: "02",
              t: "A game every single day",
              d: "Morning and evening open play across two venues. Register once, pick your slots for the week, turn up. Your court and partners land in the group chat.",
            },
            {
              n: "03",
              t: "A path, not a plateau",
              d: "From a first-timer clinic to a DUPR-rated tournament draw — coaching, games and events that connect into one ladder you can actually climb.",
            },
          ].map((item, i) => (
            <Reveal key={item.n} delay={i * 90}>
              <div className="card h-full p-7">
                <p className="font-display text-5xl text-white/10">{item.n}</p>
                <h3 className="mt-3 text-2xl">{item.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-bone/55">{item.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-ink-800/40 py-20">
        <div className="wrap">
          <Reveal>
            <SectionHeading
              eyebrow="The shop"
              title="Paddles. Balls. Grips."
              sub="The Champion Series — built with Toray carbon, tuned on our own courts, and stocked for pickup at TurfXL or delivery across Kolkata."
              action={
                <Link href="/products" className="btn-outline btn-sm shrink-0">
                  All products <ArrowRight size={14} />
                </Link>
              }
            />
          </Reveal>

          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {PRODUCT_CATEGORIES.map((c, i) => (
              <Reveal key={c.slug} delay={i * 80}>
                <Link
                  href={`/products?category=${c.slug}`}
                  className="card-hover group flex items-center justify-between gap-4 p-6"
                >
                  <span>
                    <span className="block font-display text-3xl uppercase text-bone group-hover:text-gold">{c.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-bone/45">{c.blurb}</span>
                  </span>
                  <ArrowRight size={18} className="shrink-0 text-bone/30 transition-transform group-hover:translate-x-1 group-hover:text-gold" />
                </Link>
              </Reveal>
            ))}
          </div>

          {featured.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Daily games ───────────────────────────────────────────────── */}
      <section className="wrap py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Daily games"
            title="Turn up and play"
            sub="Register your details once, pick slots for the week, check out. Confirmed players and court numbers are posted to the SuperPro WhatsApp group the moment the slot fills."
            action={
              <Link href="/games" className="btn-gold btn-sm shrink-0">
                Pick your slots <ArrowRight size={14} />
              </Link>
            }
          />
        </Reveal>

        {nextSessions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {nextSessions.map((s, i) => {
              const left = s.capacity - (s.booked ?? 0);
              return (
                <Reveal key={s.id} delay={i * 70}>
                  <Link href="/games" className="card-hover block p-5">
                    <div className="flex items-center justify-between">
                      <span className="chip">{formatDate(s.session_date)}</span>
                      <span className={left <= 2 ? "chip-gold" : "chip-live"}>{left} left</span>
                    </div>
                    <p className="mt-4 font-display text-3xl text-bone">{formatTime(s.start_time)}</p>
                    <p className="mt-1 text-sm text-bone/55">
                      {s.venue_name} · Court {s.court_number}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-gold">{formatPaise(s.price_paise)}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <div className="card px-6 py-12 text-center">
            <p className="font-display text-2xl text-bone/70">This week&apos;s schedule goes up shortly</p>
            <p className="mt-2 text-sm text-bone/45">
              Message us on WhatsApp and we&apos;ll hold you a spot the moment slots open.
            </p>
            <a href={waLink("Hi SuperPro! When do this week's game slots open?")} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm mt-5">
              <MessageCircle size={14} /> Ask on WhatsApp
            </a>
          </div>
        )}
      </section>

      {/* ── Coaching + tournaments ────────────────────────────────────── */}
      <section className="wrap grid gap-5 pb-20 lg:grid-cols-2">
        <Reveal>
          <div className="card flex h-full flex-col p-8">
            <Users size={22} className="text-gold" />
            <h3 className="mt-4 text-3xl">Coaching</h3>
            <p className="mt-3 text-sm leading-relaxed text-bone/55">
              {coaches.length > 0
                ? `${coaches.length} coaches, each with a specialisation — from a first-timer's grip to the speed-up timing that takes you past 4.5. Pick your coach, pick a slot, and we connect you directly.`
                : "Certified coaches for every level, from first-timers to DUPR-rated players. Pick your coach and we connect you directly."}
            </p>
            <ul className="mt-5 space-y-2 text-sm text-bone/60">
              {coaches.slice(0, 3).map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-gold" />
                  <span className="font-medium text-bone/80">{c.name}</span>
                  <span className="text-bone/40">— {c.headline?.split("·")[0]?.trim()}</span>
                </li>
              ))}
            </ul>
            <Link href="/coaching" className="btn-outline btn-sm mt-auto self-start pt-2">
              Meet the coaches <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="card flex h-full flex-col p-8">
            <Trophy size={22} className="text-gold" />
            <h3 className="mt-4 text-3xl">Tournaments</h3>
            {liveTournament ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-bone/55">{liveTournament.summary}</p>
                <div className="mt-5 rounded-xl border border-white/10 bg-ink-700/50 p-5">
                  <span className={liveTournament.kind === "sponsored" ? "chip" : "chip-gold"}>
                    {liveTournament.kind === "sponsored" ? "We sponsor" : "We organise"}
                  </span>
                  <p className="mt-3 font-display text-2xl text-bone">{liveTournament.title}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-bone/50">
                    <CalendarDays size={13} />
                    {formatDateRange(liveTournament.start_date, liveTournament.end_date)} · {liveTournament.venue}
                  </p>
                  {liveTournament.prize_pool_paise > 0 && (
                    <p className="mt-2 text-sm text-gold">
                      {formatPaise(liveTournament.prize_pool_paise)} prize pool
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-bone/55">
                Every tournament we run or sponsor around Kolkata, with formats, draws and results.
              </p>
            )}
            <Link href="/tournaments" className="btn-outline btn-sm mt-auto self-start pt-2">
              All tournaments <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── WhatsApp band ─────────────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-ink-800/60">
        <div className="wrap flex flex-col items-center gap-5 py-14 text-center">
          <MessageCircle size={26} className="text-[#25D366]" />
          <h2 className="text-4xl">Not sure which paddle?</h2>
          <p className="max-w-xl text-sm leading-relaxed text-bone/55">
            Tell a SuperPro rep how you play and your budget. You&apos;ll get a straight answer on WhatsApp —
            no funnel, no callback queue.
          </p>
          <a
            href={waLink(`Hi ${SITE.name}! I'd like help choosing a paddle.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-[#25D366] text-ink hover:brightness-110"
          >
            <MessageCircle size={16} /> Chat with a representative
          </a>
        </div>
      </section>
    </>
  );
}
