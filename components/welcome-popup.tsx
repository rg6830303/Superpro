"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Quote, RefreshCw, Sparkles, X } from "lucide-react";
import { Confetti } from "@/components/motion";
import { INTRO_DONE_EVENT } from "@/components/smash-intro";

/**
 * Enhanced Welcome Popup with dynamic Pickleball Motivational Quotes
 * and clear navigational pathways inspired by handwritten user notes.
 */

const GREETING = "Hi Pickler, ready to take your journey to another level!";

const MOTIVATIONAL_QUOTES = [
  "The kitchen line isn't just a rule — it's a mindset. Stay patient, dink deep.",
  "Champions aren't made on match point. They're built in 6 AM rallies.",
  "Dink first, ask questions later. Every great point starts with touch.",
  "The third-shot drop is where good players become great players.",
  "Paddle up, stay low, and let the ball do the work.",
  "A bad day of pickleball still beats the best day at a desk.",
  "Speed wins points, but patience and placement win championships.",
  "Zero excuses, one rally at a time. The court is waiting for you.",
  "It's not about how hard you hit; it's about putting the ball where they can't attack.",
  "Control the kitchen, control the court, control the match.",
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
  { label: "Playing today?", href: "/games", emoji: "🎾", note: "Daily games across Kolkata venues" },
  { label: "Products & Gear?", href: "/products", emoji: "🏓", note: "Champion Series carbon paddles & balls" },
  { label: "To improve yourself?", href: "/coaching", emoji: "📈", note: "Certified coaches & clinic sessions" },
  { label: "Ready to take a challenge?", href: "/tournaments", emoji: "🏆", note: "Competitive tournaments & draws" },
  { label: "Investment & Franchise?", href: "/about", emoji: "🤝", note: "Partner with SuperPro club network" },
];

let shownThisLoad = false;

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function WelcomePopup() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const welcome = params.get("welcome");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"intent" | "signup" | "login">("intent");
  const [quoteIndex, setQuoteIndex] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    if (welcome) {
      const rest = new URLSearchParams(params.toString());
      rest.delete("welcome");
      const q = rest.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [params, pathname, router, welcome]);

  function nextQuote() {
    setQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
  }

  useEffect(() => {
    const celebrating = welcome === "signup" || welcome === "login";

    if (!celebrating && shownThisLoad) return;
    shownThisLoad = true;

    setMode(celebrating ? (welcome as "signup" | "login") : "intent");
    setQuoteIndex(Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));

    let timer = 0;
    const show = () => {
      window.clearTimeout(timer);
      setOpen(true);
    };

    window.addEventListener(INTRO_DONE_EVENT, show, { once: true });
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
  const celebrateLine = pick(mode === "signup" ? JOIN_LINES : BACK_LINES);

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

        {/* Volt accent rail */}
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
          <p className="eyebrow">{celebrating ? (mode === "signup" ? "Welcome aboard" : "Welcome back") : "SuperPro Pickleball"}</p>
          <h2 className="mt-2 font-display text-[24px] leading-[1.18] text-ink sm:text-[28px]">
            {celebrating ? celebrateLine : GREETING}
          </h2>

          {celebrating ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                {mode === "signup"
                  ? "Your wallet, bookings, and player profile live in one place now. Keep your DUPR rating updated for balanced tournament draws."
                  : "Everything you booked is ready. Check out the courts or discover other picklers."}
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
              {/* Daily Motivational Quote Card */}
              <div className="mt-4 rounded-xl border border-line bg-mist/30 p-4 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-volt-deep font-bold">
                    <Sparkles size={12} /> Daily Pickler Motivation
                  </span>
                  <button
                    type="button"
                    onClick={nextQuote}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] text-ink/60 hover:bg-mist hover:text-ink transition-colors"
                    title="Get another quote"
                  >
                    <RefreshCw size={10} /> New Quote
                  </button>
                </div>
                <p className="mt-2 text-xs italic leading-relaxed text-ink/85 flex items-start gap-2">
                  <Quote size={14} className="shrink-0 text-volt-deep rotate-180 mt-0.5" />
                  <span>&ldquo;{MOTIVATIONAL_QUOTES[quoteIndex]}&rdquo;</span>
                </p>
              </div>

              <p className="mt-5 text-sm font-semibold text-ink">So, what are you here for?</p>

              <div className="mt-3 grid gap-2">
                {INTENTS.map((intent, i) => (
                  <Link
                    key={intent.href}
                    href={intent.href}
                    onClick={close}
                    style={{ animationDelay: `${50 + i * 40}ms` }}
                    className="stagger-item group flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-volt hover:bg-mist"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mist text-base transition-transform group-hover:scale-110">
                      {intent.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{intent.label}</span>
                      <span className="block truncate text-[11px] text-ink/50">{intent.note}</span>
                    </span>
                    <span className="font-mono text-xs text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-volt-deep">
                      →
                    </span>
                  </Link>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={close}
                  className="text-[12px] text-ink/45 underline hover:text-ink"
                >
                  Just looking around
                </button>
                <span className="font-mono text-[10px] text-ink/35">Press ESC to dismiss</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
