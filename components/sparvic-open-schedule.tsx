import { CalendarDays } from "lucide-react";
import { OPEN, OPEN_CATEGORIES, OPEN_SCHEDULE } from "@/lib/sparvic-open";

/**
 * The Sparvic Open match schedule by category, grouped by day. `mine` marks
 * the categories the signed-in player is confirmed in.
 */
export function SparvicOpenSchedule({ mine = [], compact = false }: { mine?: string[]; compact?: boolean }) {
  const days = [...new Set(OPEN_SCHEDULE.map((s) => `${s.day}|${s.date}`))];
  const label = (id: string) => OPEN_CATEGORIES.find((c) => c.id === id)?.label ?? id;
  return (
    <section>
      <h2 className={compact ? "text-2xl" : "headline-section"}>
        <CalendarDays size={20} className="mr-2 inline text-volt-deep" />
        Match schedule
      </h2>
      <p className="mt-1 text-sm text-ink/60">{OPEN.dates} · {OPEN.venue}. Report at your category&apos;s start time.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {days.map((d) => {
          const [day, date] = d.split("|");
          return (
            <div key={d} className="card p-5">
              <p className="eyebrow">{day}</p>
              <p className="mt-1 text-lg font-semibold text-ink">{date}</p>
              <ul className="mt-3 space-y-2.5">
                {OPEN_SCHEDULE.filter((s) => s.day === day).map((s) => {
                  const yours = mine.includes(s.category);
                  return (
                    <li key={s.category} className={`rounded-lg px-3 py-2 ${yours ? "bg-volt/25 ring-1 ring-volt-deep/30" : "bg-ink/[0.03]"}`}>
                      <p className="text-xs font-semibold tabular-nums text-volt-deep">{s.time}</p>
                      <p className="text-sm font-semibold text-ink">
                        {label(s.category)}
                        {yours && <span className="chip-volt ml-2 align-middle">You&apos;re in</span>}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink/50">Timings may shift on the day; fixtures and court numbers are shared on Sparvic and WhatsApp.</p>
    </section>
  );
}
