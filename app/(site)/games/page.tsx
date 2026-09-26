import type { Metadata } from "next";
import { GamesFlow } from "@/components/games-flow";
import { SignInGate } from "@/components/sign-in-gate";
import { MixerRules } from "@/components/mixer-rules";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";
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
  // The viewer is resolved first: the slot query needs it to work out which
  // names on each roster are people this player follows.
  const session = await getPlayerSession();
  const [sessions, venues, settings] = await Promise.all([
    getWeekSessions(7, session?.id ?? null),
    getVenues(),
    getSettings(),
  ]);

  const profile = session ? await getUserRow(session.id) : null;
  const walletPaise = Number(profile?.wallet_balance_paise ?? 0);

  return (
    <div className="wrap section">
      <p className="eyebrow">Daily games</p>
      <h1 className="mt-3 headline-page">Turn up and play</h1>
      <p className="lede mt-4 max-w-2xl">
        Open play across {venues.length || 2} venues, seven days a week. Register once, pick your slots for
        the week, and your name and court number are posted to the Sparvic WhatsApp group.
      </p>

      <div className="mt-10">
        {profile ? (
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
            }}
          />
        ) : (
          <SignInGate
            title="Sign in to book"
            detail="Slots are held against your account, so your name, rating and bookings stay in one place."
            next="/games"
          />
        )}
      </div>

      <MixerRules />

      {settings.booking_terms && (
        <p className="mt-10 max-w-2xl text-xs leading-relaxed text-ink/45">{settings.booking_terms}</p>
      )}
    </div>
  );
}
