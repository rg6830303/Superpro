import type { Metadata } from "next";
import { GamesFlow } from "@/components/games-flow";
import { SignInGate } from "@/components/sign-in-gate";
import { MixerRules } from "@/components/mixer-rules";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
import { getVenues, getWeekSessions } from "@/lib/queries";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { getSettings } from "@/lib/settings";
import { inClubhouse } from "@/lib/booking-context";
import { SlotSchedule } from "@/components/slot-schedule";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily games",
  description:
    "Open pickleball games every morning and evening in Kolkata. Register, pick your slots for the week, and get your court number on WhatsApp.",
};

export default async function GamesPage() {
  // The viewer is resolved first: the slot query needs it to work out which
  // names on each roster are people this player follows.
  const session = await getPlayerSession();
  // Clubhouse: book from today onwards. Website: view the last week and the next.
  const clubhouse = await inClubhouse();
  const [sessions, venues, settings] = await Promise.all([
    getWeekSessions(clubhouse ? 7 : 8, session?.id ?? null, clubhouse ? 0 : 7),
    getVenues(),
    getSettings(),
  ]);

  const profile = clubhouse && session ? await getUserRow(session.id) : null;
  const walletPaise = Number(profile?.wallet_balance_paise ?? 0);

  return (
    <div className="wrap section">
      <p className="eyebrow">{clubhouse ? "Book a game" : "Daily games"}</p>
      <h1 className="mt-3 headline-page">{clubhouse ? "Pick your slots" : "Turn up and play"}</h1>
      <p className="lede mt-4 max-w-2xl">
        Open play across {venues.length || 2} venues, seven days a week. Register once, pick your slots for
        the week, and your name and court number are posted to the Sparvic WhatsApp group.
      </p>

      <div className="mt-10">
        {clubhouse && profile ? (
          <GamesFlow
            sessions={sessions}
            razorpayEnabled={isRazorpayEnabled}
            razorpayKeyId={razorpayKeyId}
            walletPaise={walletPaise}
            player={{
              name: profile.full_name,
              phone: profile.phone ?? "",
              email: profile.email,
              skill: profile.skill_level,
              dupr: profile.dupr,
              dupr_id: profile.dupr_id,
              gender: profile.gender ?? null,
            }}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <SlotSchedule sessions={sessions} />
            <div className="lg:sticky lg:top-24">
              <SignInGate
                title="Sign in to book"
                detail="Slots are booked from your member clubhouse, so your name, rating, wallet and bookings stay in one place."
                next="/dashboard/play"
                />
            </div>
          </div>
        )}
      </div>

      <MixerRules />

      {settings.booking_terms && (
        <p className="mt-10 max-w-2xl text-xs leading-relaxed text-ink/45">{settings.booking_terms}</p>
      )}
    </div>
  );
}
