// Local visual QA fixture. Never available on deployed domains.
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { DesignReviewGuard } from "@/components/design-review-guard";
import { DemoShell } from "@/components/demo-shell";
import { DashboardView, type TabKey } from "@/components/dashboard-view";
import { DemoHomeHero } from "@/components/demo-home-hero";
import { PlayerDirectory } from "@/components/player-directory";
import { GamesFlow } from "@/components/games-flow";
import { getWeekSessions } from "@/lib/queries";
import "../(site)/demo.css";

export default async function DesignReview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const host = (await headers()).get("host")?.split(":")[0];
  if (process.env.NODE_ENV !== "development" || !["localhost", "127.0.0.1"].includes(host ?? "")) notFound();
  const { view = "overview" } = await searchParams;
  if (view === "games") return <DesignReviewGuard><DemoShell playerName="Ananya Sen"><div className="wrap section"><p className="eyebrow">LOCAL DESIGN REVIEW · FICTIONAL PLAYER</p><h1 className="headline-page mt-3">A good day starts on court.</h1><p className="lede mt-4 mb-8">Review the booking layout. No test booking needs to be submitted.</p><GamesFlow sessions={await getWeekSessions(7)} razorpayEnabled={false} razorpayKeyId="" walletPaise={250000} player={{ name: "Ananya Sen", email: "player@example.com", phone: "", skill: "intermediate", dupr: 3.75, gender: "female" }} /></div></DemoShell></DesignReviewGuard>;
  const profile = { email: "player@example.com", handle: "sample-player", avatar_url: null, bio: "Here for the rallies, staying for the people. Usually on court before the city wakes up.", date_of_birth: null, gender: "female", full_name: "Ananya Sen", phone: "", skill_level: "intermediate", city: "Kolkata", dupr: 3.75, dupr_id: null, whatsapp_opt_in: false, wallet_balance_paise: 250000 };
  return <DesignReviewGuard><DemoShell playerName={profile.full_name}><div style={{ padding: "12px 24px", background: "#f6efc7", fontSize: 12 }}>Local design review · Fictional player · Use the real pages for account actions. <a href="/design-review?view=home">Home</a> · <a href="/design-review">Account</a> · <a href="/design-review?view=wallet">Wallet</a> · <a href="/design-review?view=profile">Profile</a> · <a href="/design-review?view=community">Community</a></div>{view === "home" ? <DemoHomeHero name={profile.full_name} slots={12} /> : view === "community" ? <div className="wrap section"><p className="eyebrow">YOUR PEOPLE ARE HERE</p><h1 className="headline-page mb-8">Find your next doubles partner.</h1><PlayerDirectory signedIn initial={["Ananya Sen", "Arjun Mehta", "Riya Kapoor", "Kabir Das", "Meera Shah", "Dev Patel"].map((name, i) => ({ id: `fixture-${i}`, handle: `sample-${i}`, full_name: name, avatar_url: null, city: "Kolkata", skill_level: i % 2 ? "advanced" : "intermediate", dupr: 3.5 + i / 10, followers: 10 + i, is_following: i === 1, follows_me: i === 1 }))} /></div> : <DashboardView key={view} session={{ id: "visual-fixture", name: profile.full_name, email: profile.email }} profile={profile} initialTab={(["overview", "wallet", "profile", "activity"].includes(view) ? view : "overview") as TabKey} walletTx={[]} games={[]} coaching={[]} entries={[]} orders={[]} razorpayEnabled={true} razorpayKeyId="" />}</DemoShell></DesignReviewGuard>;
}
