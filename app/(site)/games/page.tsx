import type { Metadata } from "next";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { GamesFlow } from "@/components/games-flow";
import { getPlayerSession } from "@/lib/auth";
import { getVenues, getWeekSessions } from "@/lib/queries";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily games",
  description:
    "Open pickleball games every morning and evening in Kolkata. Register, pick your slots for the week, and get your court number on WhatsApp.",
};

export default async function GamesPage() {
  const [sessions, venues, session, settings] = await Promise.all([
    getWeekSessions(7),
    getVenues(),
    getPlayerSession(),
    getSettings(),
  ]);

  return (
    <div className="wrap py-14">
      <p className="eyebrow">Daily games</p>
      <h1 className="mt-3 text-[clamp(2.5rem,7vw,4.25rem)]">Turn up and play</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-bone/55">
        Open play across {venues.length || 2} venues, seven days a week. Register once, pick your slots for
        the week, and your name and court number are posted to the SuperPro WhatsApp group.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: CalendarDays, k: "7 days a week", v: "Morning and evening sessions" },
          { icon: Users, k: "8 per court", v: "Rotating doubles, all levels" },
          { icon: Clock, k: "60 minutes", v: "Balls and spare paddles provided" },
        ].map((f) => (
          <div key={f.k} className="card flex items-start gap-3 p-4">
            <f.icon size={18} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <p className="font-display text-lg uppercase text-bone">{f.k}</p>
              <p className="text-xs text-bone/50">{f.v}</p>
            </div>
          </div>
        ))}
      </div>

      {venues.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {venues.map((v) => (
            <a
              key={v.id}
              href={v.maps_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="chip hover:border-gold/50 hover:text-gold"
            >
              <MapPin size={12} /> {v.name}
              {v.area ? `, ${v.area}` : ""}
            </a>
          ))}
        </div>
      )}

      <div className="mt-10">
        <GamesFlow
          sessions={sessions}
          razorpayEnabled={isRazorpayEnabled}
          razorpayKeyId={razorpayKeyId}
          defaults={session ? { name: session.name, email: session.email } : undefined}
        />
      </div>

      {settings.booking_terms && (
        <p className="mt-10 max-w-2xl text-xs leading-relaxed text-bone/35">{settings.booking_terms}</p>
      )}
    </div>
  );
}
