import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Phone, ShieldCheck, Trophy } from "lucide-react";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
import { ensureSchema } from "@/lib/schema";
import { inClubhouse } from "@/lib/booking-context";
import { isRazorpayEnabled } from "@/lib/razorpay";
import { formatPaise } from "@/lib/money";
import { ELIGIBILITY, MATCH_FORMAT, OPEN, OPEN_CATEGORIES, OPEN_RULES } from "@/lib/sparvic-open";
import { myEntries } from "@/lib/sparvic-open-server";
import { SparvicOpenForm } from "@/components/sparvic-open-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sparvic Open Tournament",
  description: `${OPEN.dates} at ${OPEN.venue}. Nine DUPR-banded categories for players rated below ${OPEN.maxDupr.toFixed(1)}.`,
};

const REGISTER = "/dashboard/sparvic-open";

/**
 * The Sparvic Open. On the website it's a preview with a single way in
 * (create an account, then register); inside the clubhouse the same page
 * carries the registration form and the player's entries.
 */
export default async function SparvicOpenPage() {
  const clubhouse = await inClubhouse();
  const session = clubhouse ? await getPlayerSession() : null;
  let form: React.ReactNode = null;
  if (clubhouse && session) {
    await ensureSchema();
    const [profile, entries] = await Promise.all([getUserRow(session.id), myEntries(session.id)]);
    if (profile) {
      form = (
        <SparvicOpenForm
          razorpayEnabled={isRazorpayEnabled}
          profile={{
            name: profile.full_name,
            email: profile.email,
            phone: profile.phone ?? "",
            gender: profile.gender ?? null,
            dupr: profile.dupr != null ? Number(profile.dupr) : null,
            dupr_id: profile.dupr_id ?? null,
          }}
          entries={entries.map((e) => ({ reference: e.reference, categories: e.categories, amount_paise: e.amount_paise, payment_status: e.payment_status, created_at: e.created_at }))}
        />
      );
    }
  }

  const cta = (
    <div className="so-cta">
      <p className="text-sm font-semibold text-ink">Registration is open to Sparvic members rated below DUPR {OPEN.maxDupr.toFixed(1)}.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/signup?next=${encodeURIComponent(REGISTER)}`} className="btn-volt">Create an account &amp; register <ArrowRight size={16} /></Link>
        <Link href={`/login?next=${encodeURIComponent(REGISTER)}`} className="btn-outline">I already have an account</Link>
      </div>
    </div>
  );

  return (
    <div className="wrap section">
      <section className="so-hero">
        <p className="so-kicker"><Trophy size={14} /> Tournament · DUPR below {OPEN.maxDupr.toFixed(1)}</p>
        <h1>{OPEN.name}</h1>
        <p className="so-tagline">{OPEN.tagline}</p>
        <div className="so-facts">
          <span><CalendarDays size={15} /> {OPEN.dates}</span>
          <span><MapPin size={15} /> {OPEN.venue}</span>
          <a href={`tel:+${OPEN.contactDigits}`}><Phone size={15} /> {OPEN.contactDisplay}</a>
        </div>
        <p className="so-offer">{OPEN.earlyOffer}</p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div className="space-y-8 min-w-0">
          <section>
            <h2 className="headline-section">Categories &amp; entry fees</h2>
            <p className="mt-1 text-sm text-ink/60">Doubles fees are per team. Enter as many categories as you&apos;re eligible for.</p>
            <div className="table-wrap mt-4">
              <table className="tbl">
                <thead><tr><th>Category</th><th>Entry fee</th><th>Gold</th><th>Silver</th></tr></thead>
                <tbody>
                  {OPEN_CATEGORIES.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.label}</td>
                      <td>{formatPaise(c.feePaise)}</td>
                      <td>₹{c.gold.toLocaleString("en-IN")}</td>
                      <td>₹{c.silver.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink/50">Prize pool is tentative. Semi-finalist prizes to be confirmed.</p>
          </section>

          <section>
            <h2 className="headline-section flex items-center gap-2"><ShieldCheck size={20} className="text-volt-deep" /> Eligibility</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ELIGIBILITY.map((e) => (
                <div key={e.title} className="card p-5">
                  <p className="font-semibold text-ink">{e.title}</p>
                  <p className="mt-1 text-sm text-ink/65">{e.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="headline-section">Match format</h2>
            <p className="mt-2 text-sm text-ink/65">
              Every category: group stages to {MATCH_FORMAT.group}, knockouts to {MATCH_FORMAT.knockouts}, semi-finals to {MATCH_FORMAT.semis},
              finals to {MATCH_FORMAT.finals}. All service points, win by 2. Schedule to be confirmed by the organiser.
            </p>
          </section>

          <section>
            <h2 className="headline-section">Rules &amp; regulations</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {OPEN_RULES.map((r, i) => (
                <div key={r.title} className="card p-5">
                  <p className="font-semibold text-ink">{i + 1}. {r.title}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink/65">
                    {r.points.map((pt) => <li key={pt}>{pt}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={`min-w-0 lg:sticky lg:top-24 ${clubhouse ? "order-first lg:order-none" : ""}`}>
          {clubhouse ? (
            <>
              <h2 className="headline-section mb-4">Register</h2>
              {form}
            </>
          ) : (
            cta
          )}
        </aside>
      </div>
    </div>
  );
}
