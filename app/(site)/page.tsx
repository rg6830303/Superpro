import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Counter, Reveal, ScoreMeter, TiltCard } from "@/components/motion";
import { Paddle3D } from "@/components/paddle-3d";
import { getAnnouncements, getCoaches, getFeaturedProducts, getTournaments, getWeekSessions } from "@/lib/queries";
import { formatDate, formatTime, isPast } from "@/lib/dates";
import { DUPR_BANDS } from "@/lib/dupr";
import { formatPaise, perPlayerPaise } from "@/lib/money";
import { PRODUCT_CATEGORIES, SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, sessions, tournaments, coaches, announcements] = await Promise.all([
    getFeaturedProducts(4),
    getWeekSessions(7),
    getTournaments(),
    getCoaches(),
    getAnnouncements(1),
  ]);

  const live = sessions.filter((s) => !isPast(s.session_date, s.start_time) && (s.booked ?? 0) < s.capacity);
  const nextUp = live.slice(0, 3);
  const openTournament = tournaments.find((t) => t.registration_open) ?? tournaments[0];
  const notice = announcements[0];
  const hero = featured[0];
  const rest = featured.slice(1, 4);

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────────
          Asymmetric on purpose: the claim sits left, the object right, so the
          eye lands on the sentence before the product. ──────────────────── */}
      <section className="border-b border-line">
        <div className="wrap grid min-w-0 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="eyebrow animate-wipe-in">Kolkata · since 2024</p>

            <h1 className="mt-5 animate-rise-in headline-hero">
              Pickleball,
              <br />
              played <span className="underscore">properly</span>.
            </h1>

            <p className="lede mt-6 max-w-md animate-rise-in [animation-delay:80ms]">
              Champion Series paddles, open games every morning and evening, and coaches who rebuild your third
              shot rather than your confidence.
            </p>

            <div className="mt-9 flex animate-rise-in flex-wrap items-center gap-3 [animation-delay:140ms]">
              <Link href="/games" className="btn-volt">
                Book today&apos;s game <ArrowRight size={16} />
              </Link>
              <Link
                href="/products"
                className="link-underline group inline-flex items-center gap-1.5 text-sm font-semibold text-ink"
              >
                Shop the Champion Series
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </div>

            {/* A scoreboard rail, not a stat-card triple. */}
            <dl className="mt-9 grid grid-cols-3 items-end gap-4 border-t border-line pt-6">
              {[
                { n: live.length, label: "Open slots this week" },
                { n: coaches.length, label: "Certified coaches" },
                { n: tournaments.length, label: "Draws run & backed" },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <Counter to={s.n} className="block font-display text-[2rem] leading-none text-ink sm:text-[2.75rem]" />
                    <span className="mt-2 block font-mono text-[9px] uppercase leading-tight tracking-[0.12em] text-ink/50 sm:text-[10px]">
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
                          </dl>
          </div>

          <div className="relative">
            <div aria-hidden className="court-grid court-grid-drift absolute inset-x-0 bottom-8 top-8 -z-10 rounded-card" />
            <Paddle3D priority />
          </div>
        </div>
      </section>

      {notice && (
        <Link
          href={notice.link_url ?? "/tournaments"}
          className="group block border-b border-line bg-volt-soft transition-colors hover:bg-volt/20"
        >
          <div className="wrap flex items-center gap-4 py-3.5">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-volt-deep">
              {notice.kind}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink/80">{notice.title}</span>
            <ArrowRight size={15} className="shrink-0 text-ink transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      )}

      {/* ── Next on court ─────────────────────────────────────────────────── */}
      <section className="wrap section">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="rule-head headline-section">Next on court</h2>
              <p className="lede mt-4 max-w-xl">
                Register once, pick your slots, turn up. Your name and court number reach the games group
                before you leave the house.
              </p>
            </div>
            <Link href="/games" className="btn-outline btn-sm">
              All slots <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        {nextUp.length > 0 ? (
          <div className="stagger mt-10 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nextUp.map((s, i) => {
              const left = s.capacity - (s.booked ?? 0);
              return (
                <Reveal key={s.id} delay={i * 70}>
                  <Link href="/games" className="group block h-full">
                    <TiltCard className="h-full">
                      <article className="card-hover flex h-full flex-col p-6">
                        <div className="flex items-start justify-between gap-3">
                          <span className="kicker">{formatDate(s.session_date)}</span>
                          <span className={left <= 2 ? "chip-warn" : "chip-volt"}>
                            <span className="live-dot" aria-hidden />
                            {left} left
                          </span>
                        </div>
                        <p className="mt-5 font-display text-5xl leading-none tabular-nums text-ink">
                          {formatTime(s.start_time)}
                        </p>
                        <p className="mt-3 flex items-center gap-1.5 text-sm text-ink/65">
                          <MapPin size={13} /> {s.venue_name} · Court {s.court_number}
                        </p>
                        <div className="mt-6 border-t border-line pt-4">
                          <ScoreMeter value={s.booked ?? 0} max={s.capacity} label="Court filling" />
                        </div>
                        <p className="mt-4 font-mono text-sm tabular-nums text-ink">{formatPaise(perPlayerPaise(s))}</p>
                      </article>
                    </TiltCard>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-card border border-dashed border-line-strong p-10 text-center">
            <p className="font-display text-2xl text-ink/70">This week&apos;s schedule goes up shortly</p>
            <Link href="/games" className="btn-outline btn-sm mt-5">
              See the calendar
            </Link>
          </div>
        )}
      </section>

      {/* ── The ladder ─────────────────────────────────────────────────────
          Replaces the usual three feature cards with something a player can
          actually locate themselves on. ─────────────────────────────────── */}
      <section className="section border-y border-line bg-mist">
        <div className="wrap grid min-w-0 gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal variant="left">
            <div className="lg:sticky lg:top-28">
              <h2 className="rule-head headline-section">Find your rung</h2>
              <p className="lede mt-5">
                Every session, coach and draw is banded by DUPR, so you always know which court you belong on —
                and what it takes to move up one.
              </p>
              <Link href="/signup" className="btn-primary mt-8">
                Get your band <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>

          <ol className="space-y-4">
            {DUPR_BANDS.map((band, i) => (
              <Reveal key={band.level} delay={i * 90}>
                <li className="card flex items-center gap-6 p-6 transition-colors hover:border-line-strong">
                  <span className="font-mono text-[11px] tabular-nums text-ink/35">0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-2xl text-ink">{band.label}</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                      DUPR {band.range}
                    </p>
                  </div>
                  <div className="hidden w-32 sm:block">
                    <ScoreMeter value={i + 1} max={DUPR_BANDS.length} />
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Shop ──────────────────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="wrap section">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="rule-head headline-section">The kit</h2>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_CATEGORIES.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/products?category=${c.slug}`}
                    className="rounded-pill border border-line px-4 py-2 text-[13px] font-medium text-ink/70 transition-colors hover:border-ink hover:text-ink"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="mt-10 grid min-w-0 gap-5 lg:grid-cols-[1.15fr_1fr]">
            {hero && (
              <Reveal variant="scale">
                <Link href={`/products/${hero.slug}`} className="group block h-full">
                  <article className="card-hover flex h-full flex-col overflow-hidden">
                    <div className="relative aspect-[16/11] overflow-hidden bg-mist">
                      {hero.image_url && (
                        <Image
                          src={hero.image_url}
                          alt={hero.name}
                          fill
                          sizes="(max-width: 1024px) 100vw, 55vw"
                          className="object-contain p-8 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                        />
                      )}
                      <span className="chip-ink absolute left-5 top-5">Flagship</span>
                    </div>
                    <div className="flex flex-1 flex-col p-7">
                      <h3 className="font-display text-3xl text-ink">{hero.name}</h3>
                      {hero.tagline && (
                        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink/65">{hero.tagline}</p>
                      )}
                      <p className="mt-auto pt-6 font-display text-3xl tabular-nums text-ink">
                        {formatPaise(hero.price_paise)}
                      </p>
                    </div>
                  </article>
                </Link>
              </Reveal>
            )}

            <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {rest.map((p, i) => (
                <Reveal key={p.id} delay={80 + i * 70}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Coaching & tournaments ────────────────────────────────────────── */}
      <section className="wrap grid min-w-0 gap-5 pb-16 sm:pb-20 lg:grid-cols-2">
        <Reveal>
          <div className="panel flex h-full flex-col p-8">
            <h2 className="font-display text-3xl text-ink">Coaching</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">
              Each coach owns a rung of the ladder — first paddle, first rally, first competitive match, first
              rating. Pick the one who matches where you are.
            </p>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {coaches.slice(0, 3).map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="text-sm font-semibold text-ink">{c.name}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink/55">
                    {c.dupr ? `DUPR ${Number(c.dupr).toFixed(1)}` : "Coach"}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/coaching" className="btn-outline btn-sm mt-auto self-start pt-2">
              Meet the coaches <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div className="panel-ink flex h-full flex-col p-8">
            <h2 className="font-display text-3xl text-paper">Tournaments</h2>
            {openTournament ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-paper/65">{openTournament.summary}</p>
                <div className="mt-6 border-t border-paper/15 pt-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-volt">
                    {openTournament.kind === "sponsored" ? "We back it" : "We run it"}
                  </p>
                  <p className="mt-2 font-display text-2xl text-paper">{openTournament.title}</p>
                  {openTournament.prize_pool_paise > 0 && (
                    <p className="mt-2 font-mono text-sm tabular-nums text-volt">
                      {formatPaise(openTournament.prize_pool_paise)} prize pool
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-paper/65">
                Every draw we run or back around {SITE.city}, with formats, brackets and results.
              </p>
            )}
            <Link
              href="/tournaments"
              className="btn btn-sm mt-auto self-start border border-paper/25 text-paper hover:border-volt hover:text-volt"
            >
              All tournaments <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
