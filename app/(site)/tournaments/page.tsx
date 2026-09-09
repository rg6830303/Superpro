import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { EmptyState, Reveal, SectionHeading } from "@/components/ui";
import { getTournaments } from "@/lib/queries";
import { formatDateRange } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { Tournament } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tournaments",
  description:
    "Pickleball tournaments around Kolkata that SuperPro organises or sponsors — formats, prize pools, draws and results.",
};

function TournamentCard({ t }: { t: Tournament }) {
  const isOpen = t.status === "open" && t.registration_open;
  return (
    <Link href={`/tournaments/${t.slug}`} className="card-hover group flex flex-col gap-5 p-6 sm:flex-row">
      <div className="flex h-28 w-full shrink-0 flex-col justify-between rounded-xl border border-line bg-mist p-4 sm:w-40">
        <span className="kicker">{t.kind === "sponsored" ? "Partner" : "Host"}</span>
        <span className="font-display text-4xl tabular-nums leading-none text-ink">
          {t.start_date ? String(t.start_date).slice(0, 4) : "—"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={t.kind === "sponsored" ? "chip" : "chip-volt"}>
            {t.kind === "sponsored" ? "We sponsor" : "We organise"}
          </span>
          {isOpen && <span className="chip-volt">Registration open</span>}
          {t.status === "completed" && <span className="chip">Completed</span>}
        </div>

        <h3 className="mt-3 text-2xl group-hover:text-volt-deep">{t.title}</h3>

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink/65">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={12} /> {formatDateRange(t.start_date, t.end_date)}
          </span>
          {t.venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} /> {t.venue}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users size={12} /> {t.teams ?? 0}/{t.max_teams} teams
          </span>
        </div>

        {t.summary && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink/70">{t.summary}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {t.prize_pool_paise > 0 && (
            <span className="font-semibold text-volt-deep">{formatPaise(t.prize_pool_paise)} prize pool</span>
          )}
          {t.entry_fee_paise > 0 && <span className="text-ink/65">Entry {formatPaise(t.entry_fee_paise)}</span>}
          {t.result_note && <span className="text-ink/75">{t.result_note}</span>}
        </div>
      </div>

      <ArrowRight size={18} className="hidden shrink-0 self-center text-ink/40 transition-transform group-hover:translate-x-1 group-hover:text-volt-deep sm:block" />
    </Link>
  );
}

export default async function TournamentsPage() {
  const tournaments = await getTournaments();

  const open = tournaments.filter((t) => t.status === "open");
  const upcoming = tournaments.filter((t) => t.status === "announced" || t.status === "closed");
  const past = tournaments.filter((t) => t.status === "completed");

  return (
    <div className="wrap py-14">
      <p className="eyebrow">Tournaments</p>
      <h1 className="mt-3 text-[clamp(2.5rem,7vw,4.25rem)]">Play for something</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/70">
        Every draw we run, and every event around Kolkata we put our name behind. Published formats, published
        prize money, published results.
      </p>

      {tournaments.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="No tournaments listed yet"
            sub="The next SuperPro draw will be announced here and in the WhatsApp group."
          />
        </div>
      ) : (
        <div className="mt-12 space-y-16">
          {open.length > 0 && (
            <section>
              <SectionHeading eyebrow="Enter now" title="Registration open" />
              <div className="space-y-4">
                {open.map((t, i) => (
                  <Reveal key={t.id} delay={i * 70}>
                    <TournamentCard t={t} />
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <SectionHeading
                eyebrow="On the calendar"
                title="Announced"
                sub="Dates locked, entries not open yet. We post the moment they are."
              />
              <div className="space-y-4">
                {upcoming.map((t, i) => (
                  <Reveal key={t.id} delay={i * 70}>
                    <TournamentCard t={t} />
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <SectionHeading eyebrow="The record" title="Past events" />
              <div className="space-y-4">
                {past.map((t, i) => (
                  <Reveal key={t.id} delay={i * 70}>
                    <TournamentCard t={t} />
                  </Reveal>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="mt-16 flex flex-col gap-6 border-t-2 border-ink pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl">Running an event in Kolkata?</h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink/65">
            We back city tournaments with match balls, paddles for the referee crew and prize-money support.
          </p>
        </div>
        <Link href="/about" className="btn-outline shrink-0">
          About SuperPro <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
