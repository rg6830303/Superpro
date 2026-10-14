import { MapPin, Users } from "lucide-react";
import { formatDate, formatTimeRange, isPast } from "@/lib/dates";
import { LEVEL_LABEL } from "@/lib/levels";
import { MAX_OCCUPANCY } from "@/lib/slot-rules";
import type { GameSession } from "@/lib/types";

/**
 * The website's read-only view of the daily-games schedule: recent and upcoming
 * slots posted by the club, grouped by day, with court and spots. Past slots
 * stay on the list, faded, so visitors can see how busy the club is. Booking
 * happens in the member clubhouse.
 */
export function SlotSchedule({ sessions }: { sessions: GameSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="headline-section">No slots posted yet</p>
        <p className="mt-2 text-sm text-ink/60">The club posts the week&apos;s games here. Check back soon.</p>
      </div>
    );
  }
  const days = new Map<string, GameSession[]>();
  for (const s of [...sessions].sort((a, b) => (a.session_date + a.start_time).localeCompare(b.session_date + b.start_time))) {
    days.set(s.session_date, [...(days.get(s.session_date) ?? []), s]);
  }
  return (
    <div className="space-y-8">
      {[...days].map(([date, list]) => {
        const dayPast = list.every((s) => isPast(s.session_date, s.end_time || s.start_time));
        return (
          <section key={date} className={dayPast ? "demo-day-past" : undefined}>
            <h3 className="flex items-baseline gap-3 text-lg font-semibold text-ink">
              {formatDate(date)}
              {dayPast && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">Played</span>}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => {
                const past = isPast(s.session_date, s.start_time);
                const cap = Math.min(MAX_OCCUPANCY, s.capacity);
                const left = Math.max(0, cap - (s.booked ?? 0));
                return (
                  <div key={s.id} className={`tile ${past ? "tile-expired" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-xl text-ink">{formatTimeRange(s.start_time, s.end_time)}</span>
                      <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${past ? "text-ink/50" : left === 0 ? "text-amber" : "text-volt-deep"}`}>
                        {past ? "Expired" : left === 0 ? "Full" : `${left} left`}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-ink/65">
                      <MapPin size={11} /> {s.venue_name} · <strong className="font-semibold text-ink">Court {s.court_number}</strong>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink/55">
                      <span>{s.level === "all" ? "All levels" : LEVEL_LABEL[s.level] ?? s.level}</span>
                      {s.mixed_doubles && <span>· Mixed doubles</span>}
                      <span className="inline-flex items-center gap-1">· <Users size={11} /> {s.booked ?? 0}/{cap}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
