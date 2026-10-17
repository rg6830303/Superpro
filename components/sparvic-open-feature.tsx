import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Trophy } from "lucide-react";
import { OPEN, OPEN_CATEGORIES } from "@/lib/sparvic-open";

/** The Sparvic Open as a featured card wherever tournaments are listed. */
export function SparvicOpenFeature({ href = "/sparvic-open", confirmed = [], more = 0 }: { href?: string; confirmed?: string[]; more?: number }) {
  const fees = OPEN_CATEGORIES.map((c) => c.feePaise / 100);
  return (
    <Link href={href} className="so-feature group">
      <span className="so-kicker"><Trophy size={13} /> {confirmed.length ? "You're registered" : "Registration open"}</span>
      <h2>{OPEN.name}</h2>
      <p className="so-tagline">{OPEN.tagline} Nine DUPR-banded singles and doubles categories.</p>
      <div className="so-facts">
        <span><CalendarDays size={14} /> {OPEN.dates}</span>
        <span><MapPin size={14} /> {OPEN.venue}</span>
        <span>Entry ₹{Math.min(...fees).toLocaleString("en-IN")} – ₹{Math.max(...fees).toLocaleString("en-IN")}</span>
      </div>
      {confirmed.length > 0 && (
        <p className="mt-3 text-sm font-semibold">Confirmed: {confirmed.join(" · ")}</p>
      )}
      <span className="so-feature-cta">{confirmed.length ? (more ? `Add ${more} more eligible categor${more === 1 ? "y" : "ies"}` : "View your entry") : href === "/sparvic-open" ? <>Sign up or log in to register</> : <>See details &amp; register</>} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
    </Link>
  );
}
