import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, MapPin, MessageCircle, Trophy, Users } from "lucide-react";
import { TournamentRegistration } from "@/components/tournament-registration";
import { getTournamentBySlug, getTournamentGroups } from "@/lib/queries";
import { formatDateRange } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { waLink } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) return { title: "Tournament not found" };
  return { title: t.title, description: t.summary ?? undefined };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) notFound();

  const groups = await getTournamentGroups(t.id);
  const categories = Array.isArray(t.categories) ? t.categories : [];
  const canRegister = t.status === "open" && t.registration_open;

  return (
    <div className="wrap section-tight">
      <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm text-ink/65 hover:text-volt-deep">
        <ChevronLeft size={16} /> All tournaments
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={t.kind === "sponsored" ? "chip" : "chip-volt"}>
            {t.kind === "sponsored" ? "We sponsor" : "We organise"}
          </span>
          {canRegister && <span className="chip-volt">Registration open</span>}
          {t.status === "completed" && <span className="chip">Completed</span>}
          {t.status === "closed" && <span className="chip">Entries closed</span>}
        </div>

        <h1 className="mt-4 max-w-3xl headline-page">{t.title}</h1>

        {t.summary && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/70">{t.summary}</p>}

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: CalendarDays, k: "Dates", v: formatDateRange(t.start_date, t.end_date) },
            { icon: MapPin, k: "Venue", v: t.venue ?? `${t.city} — TBA` },
            { icon: Users, k: "Draw", v: `${t.teams ?? 0} / ${t.max_teams} teams` },
            {
              icon: Trophy,
              k: "Prize pool",
              v: t.prize_pool_paise > 0 ? formatPaise(t.prize_pool_paise) : "Trophies & merch",
            },
          ].map((item) => (
            <div key={item.k} className="card p-5">
              <item.icon size={16} className="text-volt-deep" />
              <dt className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">{item.k}</dt>
              <dd className="mt-1 font-display text-xl uppercase text-ink">{item.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="mt-12 grid min-w-0 gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-8">
          {t.description && (
            <section className="card p-7">
              <h2 className="text-2xl">Format</h2>
              {t.format && <p className="mt-2 text-sm font-semibold text-volt-deep">{t.format}</p>}
              <p className="mt-3 text-sm leading-relaxed text-ink/70">{t.description}</p>

              {categories.length > 0 && (
                <div className="mt-5">
                  <p className="label">Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <span key={c} className="chip">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
                {t.entry_fee_paise > 0 && (
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Entry fee</dt>
                    <dd className="mt-1 text-ink/80">{formatPaise(t.entry_fee_paise)} per team</dd>
                  </div>
                )}
                {t.dupr_cap != null && (
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">DUPR cap</dt>
                    <dd className="mt-1 text-ink/80">{Number(t.dupr_cap).toFixed(1)} combined</dd>
                  </div>
                )}
                {t.partner_name && (
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Organised by</dt>
                    <dd className="mt-1 text-ink/80">{t.partner_name}</dd>
                  </div>
                )}
                {t.result_note && (
                  <div className="sm:col-span-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Result</dt>
                    <dd className="mt-1 font-semibold text-volt-deep">{t.result_note}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {groups.length > 0 && (
            <section className="card p-7">
              <h2 className="text-2xl">The draw</h2>
              <p className="mt-1.5 text-sm text-ink/65">
                Report 30 minutes before your first match. Groups are also posted to the WhatsApp group.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {groups.map((g) => (
                  <div key={g.id} className="rounded-xl border border-line bg-mist p-5">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xl uppercase text-ink">{g.name}</p>
                      {g.court_number && (
                        <span className="rounded-lg bg-volt px-2.5 py-1 font-display text-sm text-ink">
                          Court {g.court_number}
                        </span>
                      )}
                    </div>
                    <ol className="mt-3 space-y-1.5 text-sm text-ink/75">
                      {g.teams.map((team, i) => (
                        <li key={`${g.id}-${i}`} className="flex gap-2">
                          <span className="text-ink/45">{i + 1}.</span> {team}
                        </li>
                      ))}
                      {g.teams.length === 0 && <li className="text-ink/45">Teams to be assigned</li>}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          {canRegister ? (
            <TournamentRegistration tournament={t} razorpayEnabled={isRazorpayEnabled} razorpayKeyId={razorpayKeyId} />
          ) : (
            <div className="card p-7 text-center">
              <h2 className="text-2xl">
                {t.status === "completed" ? "This one's done" : t.status === "closed" ? "Entries closed" : "Not open yet"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                {t.status === "completed"
                  ? "Results are above. The next SuperPro draw is announced on the tournaments page and in the WhatsApp group."
                  : t.kind === "sponsored"
                    ? "Registration for this event is handled by the organisers. Message us and we'll point you to the right link."
                    : "Entries open shortly. Message a rep to be told the moment they do."}
              </p>
              <a
                href={waLink(`Hi SuperPro! I'd like details about ${t.title}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-6 w-full"
              >
                <MessageCircle size={16} /> Message a rep
              </a>
              <Link href="/tournaments" className="btn-ghost mt-2 w-full">
                Other tournaments
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
