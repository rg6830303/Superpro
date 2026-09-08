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
    <div className="wrap py-10">
      <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm text-bone/50 hover:text-gold">
        <ChevronLeft size={16} /> All tournaments
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={t.kind === "sponsored" ? "chip" : "chip-gold"}>
            {t.kind === "sponsored" ? "We sponsor" : "We organise"}
          </span>
          {canRegister && <span className="chip-live">Registration open</span>}
          {t.status === "completed" && <span className="chip">Completed</span>}
          {t.status === "closed" && <span className="chip">Entries closed</span>}
        </div>

        <h1 className="mt-4 max-w-3xl text-[clamp(2.25rem,6vw,4rem)]">{t.title}</h1>

        {t.summary && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-bone/60">{t.summary}</p>}

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
              <item.icon size={16} className="text-gold" />
              <dt className="mt-2.5 text-[11px] uppercase tracking-wider text-bone/40">{item.k}</dt>
              <dd className="mt-1 font-display text-xl uppercase text-bone">{item.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="mt-12 grid min-w-0 gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-8">
          {t.description && (
            <section className="card p-7">
              <h2 className="text-2xl">Format</h2>
              {t.format && <p className="mt-2 text-sm font-semibold text-gold">{t.format}</p>}
              <p className="mt-3 text-sm leading-relaxed text-bone/60">{t.description}</p>

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

              <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-2">
                {t.entry_fee_paise > 0 && (
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-bone/40">Entry fee</dt>
                    <dd className="mt-1 text-bone/80">{formatPaise(t.entry_fee_paise)} per team</dd>
                  </div>
                )}
                {t.dupr_cap != null && (
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-bone/40">DUPR cap</dt>
                    <dd className="mt-1 text-bone/80">{Number(t.dupr_cap).toFixed(1)} combined</dd>
                  </div>
                )}
                {t.partner_name && (
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-bone/40">Organised by</dt>
                    <dd className="mt-1 text-bone/80">{t.partner_name}</dd>
                  </div>
                )}
                {t.result_note && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wider text-bone/40">Result</dt>
                    <dd className="mt-1 font-semibold text-gold">{t.result_note}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {groups.length > 0 && (
            <section className="card p-7">
              <h2 className="text-2xl">The draw</h2>
              <p className="mt-1.5 text-sm text-bone/50">
                Report 30 minutes before your first match. Groups are also posted to the WhatsApp group.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {groups.map((g) => (
                  <div key={g.id} className="rounded-xl border border-white/10 bg-ink-700/40 p-5">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xl uppercase text-bone">{g.name}</p>
                      {g.court_number && (
                        <span className="rounded-lg bg-gold px-2.5 py-1 font-display text-sm text-ink">
                          Court {g.court_number}
                        </span>
                      )}
                    </div>
                    <ol className="mt-3 space-y-1.5 text-sm text-bone/70">
                      {g.teams.map((team, i) => (
                        <li key={`${g.id}-${i}`} className="flex gap-2">
                          <span className="text-bone/30">{i + 1}.</span> {team}
                        </li>
                      ))}
                      {g.teams.length === 0 && <li className="text-bone/30">Teams to be assigned</li>}
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
              <p className="mt-3 text-sm leading-relaxed text-bone/55">
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
                className="btn bg-[#25D366] mt-6 w-full text-ink hover:brightness-110"
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
