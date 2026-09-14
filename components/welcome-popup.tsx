"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Confetti } from "@/components/motion";
import { INTRO_DONE_EVENT } from "@/components/smash-intro";

/**
 * The welcome pop-up.
 *
 * Two jobs, one card. On arrival it says hello and asks what brought you in,
 * then sends you straight there — a first-time visitor lands on a home page
 * with five doors and this picks one for them. After a signup or a sign-in it
 * turns into a short celebration instead, keyed off `?welcome=` so the auth
 * forms only have to add a query param.
 *
 * Shown once per browser tab session. Nobody wants this on every navigation.
 */

const TAGLINES = [
  "Hi Pickler. Ready to take your journey to another level?",
  "Dink first. Ask questions later.",
  "The third shot is where friendships are made.",
  "Kolkata's kitchen is open.",
  "Paddle up. The court is waiting.",
  "Zero to DUPR-rated, one rally at a time.",
];

const JOIN_LINES = [
  "You're in. Welcome to the club, Pickler.",
  "Account live. Now go find a court.",
  "Signed, sealed, ready to serve.",
];

const BACK_LINES = [
  "Good to have you back, Pickler.",
  "Paddle's warm. Let's go.",
  "Back on court. Nice.",
];

const INTENTS = [
  { label: "Playing today", href: "/games", emoji: "🎾", note: "Daily games, venue by venue" },
  { label: "Products", href: "/products", emoji: "🏓", note: "Paddles, balls and grips" },
  { label: "To improve yourself", href: "/coaching", emoji: "📈", note: "Coaches who own your next rung" },
  { label: "Ready for a challenge", href: "/tournaments", emoji: "🏆", note: "Tournaments and draws" },
  { label: "Investment", href: "/about", emoji: "🤝", note: "Partner with SuperPro" },
];

/**
 * One appearance per page load, so the tagline lands on every open and refresh
 * but not on each client-side route change. Same reasoning as the entrance.
 */
let shownThisLoad = false;

function pick(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

export function WelcomePopup() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const welcome = params.get("welcome");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"intent" | "signup" | "login">("intent");
  const [line, setLine] = useState(TAGLINES[0]);

  const close = useCallback(() => {
    setOpen(false);
    if (welcome) {
      // Drop the param so a refresh doesn't replay the celebration.
      const rest = new URLSearchParams(params.toString());
      rest.delete("welcome");
      const q = rest.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [params, pathname, router, welcome]);

  useEffect(() => {
    const celebrating = welcome === "signup" || welcome === "login";

    if (!celebrating && shownThisLoad) return;
    shownThisLoad = true;

    setMode(celebrating ? (welcome as "signup" | "login") : "intent");
    setLine(pick(celebrating ? (welcome === "signup" ? JOIN_LINES : BACK_LINES) : TAGLINES));

    // The smash entrance owns the screen first. Wait for it to say it is done
    // rather than racing it on a timer — a slow device takes longer to load the
    // scene than a fast one, and the card must never land on top of it.
    let timer = 0;
    const show = () => {
      window.clearTimeout(timer);
      setOpen(true);
    };

    window.addEventListener(INTRO_DONE_EVENT, show, { once: true });
    // Backstop, in case the intro never reports — the card still has to appear.
    timer = window.setTimeout(show, 6500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(INTRO_DONE_EVENT, show);
    };
  }, [welcome]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const celebrating = mode !== "intent";

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end justify-center p-4 sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to SuperPro"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={close}
        className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px] animate-fade-in"
      />

      <div className="animate-pop-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-30px_rgba(6,38,61,0.5)]">
        {celebrating && <Confetti trigger={1} />}

        {/* A volt rail across the top — the only loud thing on the card. */}
        <div className="h-1.5 w-full bg-volt" />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-4 rounded-full p-2 text-ink/40 transition-colors hover:bg-mist hover:text-ink"
        >
          <X size={16} />
        </button>

        <div className="p-6 sm:p-8">
          <p className="eyebrow">{celebrating ? (mode === "signup" ? "Welcome aboard" : "Welcome back") : "SuperPro"}</p>
          <h2 className="mt-3 font-display text-[26px] leading-[1.15] text-ink sm:text-[30px]">{line}</h2>

          {celebrating ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                {mode === "signup"
                  ? "Your wallet, bookings and coaching all live in one place now. Add a photo when you get a moment — it shows next to your name on court rosters."
                  : "Everything you booked is where you left it."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/games" className="btn-volt" onClick={close}>
                  Find a game
                </Link>
                <Link href="/dashboard" className="btn-outline" onClick={close}>
                  My account
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">So — what are you here for?</p>
              <div className="mt-5 grid gap-2.5">
                {INTENTS.map((intent, i) => (
                  <Link
                    key={intent.href}
                    href={intent.href}
                    onClick={close}
                    style={{ animationDelay: `${80 + i * 55}ms` }}
                    className="stagger-item group flex items-center gap-3.5 rounded-xl border border-line px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-volt hover:bg-mist"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-mist text-lg transition-transform group-hover:scale-110">
                      {intent.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{intent.label}</span>
                      <span className="block truncate text-[12px] text-ink/50">{intent.note}</span>
                    </span>
                    <span className="font-mono text-sm text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-volt-deep">
                      →
                    </span>
                  </Link>
                ))}
              </div>
              <button type="button" onClick={close} className="mt-5 text-[12px] text-ink/45 underline hover:text-ink">
                Just looking around
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
