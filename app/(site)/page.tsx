import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, GraduationCap, MapPin, ShoppingBag, Trophy, Users } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Counter, Reveal, ScoreMeter, TiltCard } from "@/components/motion";
import { Paddle3D } from "@/components/paddle-3d";
import {
  getAnnouncements,
  getCommunitySnapshot,
  getCoaches,
  getFeaturedProducts,
  getTournaments,
  getWeekSessions,
} from "@/lib/queries";
import { initials } from "@/lib/profile";
import { formatDate, formatTime, isPast } from "@/lib/dates";
import { DUPR_BANDS } from "@/lib/dupr";
import { formatPaise, perPlayerPaise } from "@/lib/money";
import { PRODUCT_CATEGORIES, SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, sessions, tournaments, coaches, announcements, community] = await Promise.all([
    getFeaturedProducts(5),
    getWeekSessions(7),
    getTournaments(),
    getCoaches(),
    getAnnouncements(1),
    getCommunitySnapshot(),
  ]);

  const live = sessions.filter((s) => !isPast(s.session_date, s.start_time) && (s.booked ?? 0) < s.capacity);
  const nextUp = live.slice(0, 3);
  const openTournament = tournaments.find((t) => t.registration_open) ?? tournaments[0];
  const notice = announcements[0];
  const hero = featured[0];
  // The side grid is two columns wide, so an odd count always left a hole.
  const side = featured.slice(1, 5);
  const rest = side.length > 1 && side.length % 2 === 1 ? side.slice(0, -1) : side;

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────────
          Asymmetric on purpose: the claim sits left, the object right, so the
          eye lands on the sentence before the product. ──────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        {/* Decorative light behind the hero object, not behind the sentence. */}
        <div aria-hidden className="aura aura-volt -right-20 top-0 h-[26rem] w-[26rem]" />
        <div aria-hidden className="aura aura-ink -left-40 bottom-[-6rem] h-80 w-80 opacity-40" />
        <div aria-hidden className="ring-court -right-28 top-12 h-72 w-72" />
        <div className="wrap grid min-w-0 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="eyebrow animate-wipe-in inline-flex rounded-full border border-volt/30 bg-volt-soft px-3 py-1.5">Kolkata · since 2024</p>

            <h1 className="mt-5 animate-rise-in headline-hero">
              Pickleball,
              <br />
              played properly.
            </h1>

            <p className="lede mt-6 max-w-md animate-rise-in [animation-delay:80ms]">
              Champion Series paddles, open games every morning and evening, and coaches who rebuild your third
              shot rather than your confidence.
            </p>

            <div className="mt-7 grid animate-rise-in gap-3 min-[400px]:flex min-[400px]:flex-wrap min-[400px]:items-center sm:mt-9 [animation-delay:140ms]">
              <Link href="/games" className="btn-volt">
                Book today&apos;s game <ArrowRight size={16} />
              </Link>
              <Link
                href="/products"
                className="link-underline group inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-ink sm:justify-start"
              >
                Shop the Champion Series
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </div>

            {/* A scoreboard line, not a box: three figures divided by hairlines,
                and only the ones that are true today — a "0 coaches" boast on a
                fresh roster reads worse than no number at all. */}
            {(() => {
              const stats = [
                { n: live.length, label: "Open slots this week" },
                { n: coaches.length, label: "Certified coaches" },
                { n: tournaments.length, label: "Draws run & backed" },
              ].filter((st) => st.n > 0);
              if (stats.length === 0) return null;
              return (
                <dl className="mt-8 flex flex-wrap items-end gap-x-7 gap-y-4 sm:mt-10 sm:gap-x-10">
                  {stats.map((st, i) => (
                    <div key={st.label} className={i > 0 ? "border-l border-line pl-7 sm:pl-10" : ""}>
                      <dt className="sr-only">{st.label}</dt>
                      <dd>
                        <Counter to={st.n} className="block font-display text-[2rem] leading-none text-ink sm:text-[2.6rem]" />
                        <span className="mt-2 block max-w-[9rem] font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-ink/50">
                          {st.label}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              );
            })()}
          </div>

          {/* Capped on phones: at full column width the paddle stood ~500px
              tall and took a whole screen of its own under the headline. */}
          <div className="relative mx-auto w-full max-w-[240px] sm:max-w-[320px] lg:max-w-none">
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

      {/* ── The four doors ─────────────────────────────────────────────────
          Every visitor is here for one of these. Rather than make them read
          the nav, put the four rooms of the club on the page. ───────────── */}
      <section className="wrap section-tight">
        <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/products",
              icon: ShoppingBag,
              title: "Shop",
              blurb: "Champion Series paddles, outdoor balls and grips built for Kolkata humidity.",
              cta: "Browse the kit",
            },
            {
              href: "/games",
              icon: CalendarDays,
              title: "Daily Games",
              blurb: "Open slots at every venue, morning and evening. See who is coming before you book.",
              cta: "Find today's slot",
            },
            {
              href: "/coaching",
              icon: GraduationCap,
              title: "Coaching",
              blurb: "Pick the coach who owns your next rung — first rally to first DUPR rating.",
              cta: "Meet the coaches",
            },
            {
              href: "/tournaments",
              icon: Trophy,
              title: "Tournaments",
              blurb: "Draws Sparvic runs and events we back across the city. Enter with a partner.",
              cta: "See the draws",
            },
          ].map((door, i) => (
            <Reveal key={door.href} delay={i * 70}>
              {/* An index entry, not a box: a hairline above, a number, the
                  title and a line of copy. The volt rule drawing across the
                  top on hover is the only frame it ever gets. */}
              <Link
                href={door.href}
                className="group relative flex h-full items-start gap-4 border-t border-line pt-5 transition-colors before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:origin-left before:scale-x-0 before:bg-volt before:transition-transform before:duration-300 hover:before:scale-x-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-volt lg:flex-col lg:gap-0"
              >
                <span className="flex shrink-0 items-center gap-3 lg:w-full lg:justify-between">
                  <span className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-ink/35">0{i + 1}</span>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-volt-soft text-volt-deep transition-transform duration-200 group-hover:scale-110 lg:order-last">
                    <door.icon size={18} />
                  </span>
                </span>
                <span className="min-w-0 flex-1 lg:mt-6">
                  <span className="flex items-center gap-2 font-display text-xl text-ink sm:text-2xl">
                    {door.title}
                    <ArrowRight size={16} className="text-ink/30 transition-all duration-200 group-hover:translate-x-1 group-hover:text-volt-deep" />
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-ink/60">{door.blurb}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

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
                        <p className="mt-5 font-display text-4xl leading-none tabular-nums text-ink sm:text-5xl">
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

      {/* ── Community ──────────────────────────────────────────────────────
          The club is the people in it. A row of real faces and a live count
          says that faster than a paragraph could. ───────────────────────── */}
      {community.players > 0 && (
        <section className="wrap section-tight">
          <Reveal>
            <div className="panel flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="eyebrow flex items-center gap-2">
                  <Users size={14} /> Community
                </p>
                <h2 className="mt-3 font-display text-3xl text-ink sm:text-4xl">The people you&apos;ll play with</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">
                  {community.players} players have a page on Sparvic
                  {community.onCourtThisWeek > 0 && <>, and {community.onCourtThisWeek} are on court this week</>}.
                  Follow the ones you rally with and you&apos;ll hear when they book.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                <ul className="flex -space-x-2.5" aria-label="Some of our players">
                  {community.faces.map((f) => (
                    <li key={f.handle}>
                      <Link
                        href={`/players/${f.handle}`}
                        title={f.full_name}
                        className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 border-paper bg-mist font-mono text-[11px] font-semibold text-ink/60 transition-transform hover:z-10 hover:-translate-y-1"
                      >
                        {f.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.avatar_url} alt={f.full_name} className="h-full w-full object-cover" />
                        ) : (
                          initials(f.full_name)
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/players" className="btn-volt btn-sm self-start lg:self-end">
                  Find your people <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* ── The ladder ─────────────────────────────────────────────────────
          Replaces the usual three feature cards with something a player can
          actually locate themselves on. ─────────────────────────────────── */}
      <section className="band section">
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

          {/* The ladder drawn as a ladder: one track, a node per rung that grows
              and fills as it climbs. No cards — the rungs are the shape. */}
          <ol className="relative pl-10 sm:pl-14">
            <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-line via-volt/50 to-volt sm:left-[23px]" />
            {DUPR_BANDS.map((band, i) => {
              const size = [14, 20, 28][i] ?? 28;
              return (
                <Reveal as="li" key={band.level} delay={i * 90}>
                  <div className="relative flex items-center gap-5 py-6 sm:py-8">
                    <span
                      aria-hidden
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper shadow-[0_0_0_1px_rgba(0,229,95,0.45)]"
                      style={{
                        left: -24,
                        width: size,
                        height: size,
                        background: i === DUPR_BANDS.length - 1 ? "#00e55f" : `rgba(0,229,95,${0.25 + i * 0.3})`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-ink/35">Rung 0{i + 1}</p>
                      <p className="mt-1 font-display text-3xl text-ink sm:text-4xl">{band.label}</p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">DUPR {band.range}</p>
                    </div>
                    <div className="hidden w-40 sm:block">
                      <ScoreMeter value={i + 1} max={DUPR_BANDS.length} />
                    </div>
                  </div>
                  {i < DUPR_BANDS.length - 1 && <hr className="rule-fade" />}
                </Reveal>
              );
            })}
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
                    <div className="media-plate relative aspect-[16/11] overflow-hidden bg-mist">
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

      {/* ── What is pickleball ─────────────────────────────────────────────── */}
      <section className="band section">
        <div className="wrap grid min-w-0 gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div>
              <p className="eyebrow">The game</p>
              <h2 className="rule-head mt-3 headline-section">What is pickleball?</h2>
              <p className="lede mt-5 max-w-md">
                A paddle sport played on a badminton-sized court with a perforated plastic ball, over a net a
                little lower than tennis. Two or four players, underhand serve, and a seven-foot no-volley zone
                either side of the net — the kitchen.
              </p>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink/70">
                It is the fastest-growing sport in the world for one reason: a complete beginner can hold a rally
                in ten minutes, and a good player still cannot win one cheaply. The court is small enough that
                placement beats power, so the game rewards patience over athleticism.
              </p>
              <Link href="/about" className="btn-outline mt-7">
                How the game works <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>

          {/* A spec sheet, not four boxes: big figures on hairline rules. */}
          <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-10">
            {[
              { k: "20 × 44", l: "Feet of court", n: "Same as a doubles badminton court." },
              { k: "11", l: "Points to win", n: "Win by two. Serve to score." },
              { k: "7", l: "Foot kitchen", n: "No volleys inside it. Ever." },
              { k: "10 min", l: "To your first rally", n: "That is the whole pitch." },
            ].map((f, i) => (
              <Reveal key={f.l} delay={i * 60}>
                <div className="h-full border-t-2 border-ink pt-4">
                  <p className="font-display text-3xl text-ink sm:text-5xl">{f.k}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">{f.l}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink/60">{f.n}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Sparvic ───────────────────────────────────────────────────── */}
      <section className="wrap section">
        <Reveal>
          <p className="eyebrow">Why Sparvic</p>
          <h2 className="rule-head mt-3 headline-section">One place for the whole game</h2>
          <p className="lede mt-5 max-w-2xl">
            Most players in Kolkata juggle a WhatsApp group for games, a shop across town for gear and a friend
            of a friend for coaching. Sparvic is the club that holds all three, so your rating, your bookings
            and your kit live in one account.
          </p>
        </Reveal>

        {/* Six reasons as an open list — a numbered line each, divided by
            hairlines — rather than six identical boxes in a grid. */}
        <div className="mt-12 grid min-w-0 gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              t: "Play at your level",
              d: "Every slot is banded — beginner, intermediate, advanced. Your DUPR rating decides which courts open automatically, and you can always drop down a band to help someone learn.",
            },
            {
              t: "Know who you are playing",
              d: "Rosters are public before you pay. See the names on a court, and book the one with the players you want to rally against.",
            },
            {
              t: "Kit that survives the season",
              d: "Toray carbon faces and outdoor balls chosen for heat and humidity, not for a catalogue photo. Tested on the same courts you play on.",
            },
            {
              t: "Coaches with a rung each",
              d: "First paddle, first rally, first competitive match, first rating. Each coach owns a step, so you are never taught by someone aiming at the wrong problem.",
            },
            {
              t: "One wallet, no cash scramble",
              d: "Load credit once and pay for slots, coaching and gear from it. Split court fees settle automatically between the players in the slot.",
            },
            {
              t: "Draws that actually run",
              d: "Groups seeded off real ratings, entries capped, and a waitlist that moves. We run our own and back the city's.",
            },
          ].map((w, i) => (
            <Reveal key={w.t} delay={i * 55}>
              <div className="flex h-full gap-4 border-t border-line py-6">
                <span className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-volt-deep">0{i + 1}</span>
                <div className="min-w-0">
                  <h3 className="font-display text-xl text-ink">{w.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/65">{w.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Vision ─────────────────────────────────────────────────────────── */}
      <section className="band-ink section relative overflow-hidden">
        <div className="wrap grid min-w-0 gap-10 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-volt">The vision</p>
              <h2 className="mt-4 font-display text-[2rem] leading-[1.1] text-paper sm:text-[2.75rem]">
                A court within reach of every player in the city.
              </h2>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-paper/70">
                Sparvic started because there was nowhere in Kolkata to simply turn up and play. The plan has not
                changed since: put courts where people already are, keep the standard of play honest, and make the
                first paddle someone picks up a good one.
              </p>
              <Link href="/about" className="btn-volt mt-8">
                Read the full story <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>

          <div className="space-y-4">
            {[
              {
                n: "01",
                t: "Courts, everywhere",
                d: "Partner venues across every corner of the city, so nobody drives an hour for an hour of play.",
              },
              {
                n: "02",
                t: "Rated, not guessed",
                d: "Every regular carries a DUPR rating. Fair games beat friendly chaos, and ratings make draws mean something.",
              },
              {
                n: "03",
                t: "Made here",
                d: "Equipment designed for Indian conditions and priced for Indian players, instead of imported at three times the cost.",
              },
              {
                n: "04",
                t: "A pipeline, not a pastime",
                d: "Beginners to nationals. The coaching ladder and the tournament calendar are the same ladder.",
              },
            ].map((v, i) => (
              <Reveal key={v.n} delay={i * 70}>
                <div className="flex gap-5 border-b border-paper/12 pb-4 last:border-0">
                  <span className="font-mono text-sm text-volt">{v.n}</span>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl text-paper">{v.t}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-paper/65">{v.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Coaching & tournaments ────────────────────────────────────────── */}
      <section className="wrap grid min-w-0 gap-5 pb-16 sm:pb-20 lg:grid-cols-2">
        <Reveal>
          <div className="panel flex h-full flex-col p-8">
            <h2 className="font-display text-3xl text-ink">Coaching</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">
              Each coach owns a rung of the ladder — first paddle, first rally, first competitive match, first
              rating. Pick the one who matches where you are.
            </p>
            {coaches.length === 0 ? (
              <p className="mt-6 border-y border-line py-4 text-sm text-ink/55">
                The coaching roster is being put together. Coaches will appear here as soon as they are listed.
              </p>
            ) : (
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
            )}
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
