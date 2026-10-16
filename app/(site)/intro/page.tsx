import type { Metadata } from "next";
import { IntroPlayer } from "@/components/intro-player";

export const metadata: Metadata = {
  title: "Welcome to Sparvic",
  description: "The Sparvic opening film: Kolkata's pickleball community, welcoming you to the club.",
  alternates: { canonical: "/intro" },
};

/** The opening film on its own page, to watch again any time (website only). */
export default function IntroPage() {
  return (
    <div className="wrap section">
      <p className="eyebrow">Intro</p>
      <h1 className="mt-3 headline-page">Welcome to Sparvic</h1>
      <p className="lede mt-3 max-w-2xl">The film that opens the site. Kolkata&apos;s pickleball community, all in one place.</p>
      <div className="mt-8">
        <IntroPlayer />
      </div>
    </div>
  );
}
