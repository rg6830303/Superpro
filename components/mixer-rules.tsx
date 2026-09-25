import { Clock, Ban, CalendarCheck, Handshake, Users } from "lucide-react";
import { Reveal } from "@/components/motion";

const RULES = [
  {
    icon: Users,
    title: "Player cap",
    body: "Five players maximum per one-hour slot, so everyone gets real court time rather than a queue.",
  },
  {
    icon: CalendarCheck,
    title: "Flexibility",
    body: "Book as many slots as you like — consecutive or spread across the week.",
  },
  {
    icon: Ban,
    title: "Cancellations",
    body: "No backouts inside one hour of your slot. Terms apply.",
  },
  {
    icon: Clock,
    title: "Attendance",
    body: "No-shows carry a penalty. Terms apply.",
  },
  {
    icon: Handshake,
    title: "Culture",
    body: "Treat every player with respect. We compete hard and enjoy the game together.",
  },
];

/**
 * The Mixer house rules. These sit on the booking page rather than a separate
 * page because they are the terms a player is agreeing to as they pick a slot —
 * putting them a click away would mean nobody reads them.
 */
export function MixerRules() {
  return (
    <section className="section-tight border-t border-line">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Daily slots</p>
            <h2 className="rule-head headline-section mt-3">The Mixer</h2>
          </div>
          <span className="chip">House rules</span>
        </div>

        <p className="lede mt-5 max-w-2xl">
          For solo players and anyone who wants to sharpen up against new opponents every day. High energy,
          consistent play, and a family-first attitude are the standard here.
        </p>
      </Reveal>

      {/* House rules as an open list on hairlines — five boxes in a grid left
          an orphan box and read like a form. */}
      <ol className="stagger mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {RULES.map((rule, i) => (
          <li key={rule.title} className="flex gap-4 border-t border-line py-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-volt-soft text-volt-deep">
              <rule.icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] tabular-nums text-ink/35">0{i + 1}</span>
                <span className="font-display text-lg text-ink">{rule.title}</span>
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink/65">{rule.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
