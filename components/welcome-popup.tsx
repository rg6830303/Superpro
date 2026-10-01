"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, PartyPopper, Quote, Users, X } from "lucide-react";
import { INTRO_DONE_EVENT } from "@/components/smash-intro";
import { introHasFinished } from "@/lib/intro-once";

/**
 * Two cards, never both on one visit.
 *
 *   greeting — straight after sign-up or sign-in (the auth forms add
 *              `?welcome=signup|login` to the redirect and stash the first
 *              name in sessionStorage). Shown almost at once, with the next
 *              step for a new player; the query param is then stripped so a
 *              refresh or a shared link does not greet again.
 *   quote    — a single line worth reading, five seconds into a visit, once
 *              per tab session. It waits for the intro film to finish.
 */

const SEEN_KEY = "superpro:welcome-seen";
const NAME_KEY = "superpro:welcome-name";

/** Just long enough for the page to paint first, so the card lands on a finished page. */
const DELAY_MS = 600;

const QUOTES = [
  { line: "The ball does not care how you felt about the last point.", who: "Court wisdom" },
  { line: "Good players win rallies. Great players win the third shot.", who: "Sparvic coaches" },
  { line: "Dink like you have all day. Smash like you have one chance.", who: "Court wisdom" },
  { line: "You do not rise to the level of your paddle. You fall to the level of your footwork.", who: "Sparvic coaches" },
  { line: "Every regular on this court was once the newest player on it.", who: "Sparvic Kolkata" },
];

function storage(fn: (s: Storage) => string | null | void): string | null {
  try {
    return fn(window.sessionStorage) ?? null;
  } catch {
    return null;
  }
}

/**
 * Where a pop-up is an interruption rather than a welcome: the coach portal is
 * a work tool, and checkout is the one screen where nothing should get between
 * a player and the pay button.
 */
const QUIET_PATHS = ["/coach", "/checkout", "/login", "/signup", "/forgot-password", "/reset-password"];

type Card =
  | { kind: "greeting"; mode: "signup" | "login"; name: string | null }
  | { kind: "quote"; quote: (typeof QUOTES)[number] };

export function WelcomePopup() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const welcome = params.get("welcome");
  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [card, setCard] = useState<Card | null>(null);

  const close = useCallback(() => setCard(null), []);

  // Greeting: wins over everything else on this visit.
  useEffect(() => {
    if (welcome !== "signup" && welcome !== "login") return;
    const name = storage((s) => s.getItem(NAME_KEY));
    storage((s) => {
      s.removeItem(NAME_KEY);
      s.setItem(SEEN_KEY, "1");
    });
    const timer = window.setTimeout(() => setCard({ kind: "greeting", mode: welcome, name }), 450);
    // Strip the param without a navigation, so a refresh does not greet again.
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    return () => window.clearTimeout(timer);
  }, [welcome]);

  // Quote: once per tab session, after the intro, never where it would be in the way.
  useEffect(() => {
    if (quiet || welcome || storage((s) => s.getItem(SEEN_KEY)) === "1") return;
    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (storage((s) => s.getItem(SEEN_KEY)) === "1") return;
        storage((s) => s.setItem(SEEN_KEY, "1"));
        setCard({ kind: "quote", quote: QUOTES[Math.floor(Math.random() * QUOTES.length)] });
      }, DELAY_MS);
    };
    // Pages under this layout never carry the intro, so start the timer now;
    // the event only matters if an intro is actually on screen.
    const introOnScreen = !introHasFinished() && Boolean(document.querySelector("video"));
    if (!introOnScreen) arm();
    window.addEventListener(INTRO_DONE_EVENT, arm);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(INTRO_DONE_EVENT, arm);
    };
  }, [quiet, welcome]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, close]);

  if (!card || (quiet && card.kind === "quote")) return null;

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label={card.kind === "greeting" ? "Welcome" : "A word before you play"}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={close}
        className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px] animate-fade-in"
      />

      <div className="animate-pop-in relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-30px_rgba(6,38,61,0.5)]">
        <div className="h-1.5 w-full bg-volt" />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-4 rounded-full p-2 text-ink/40 transition-colors hover:bg-mist hover:text-ink"
        >
          <X size={16} />
        </button>

        {card.kind === "greeting" ? (
          <div className="p-6 sm:p-8">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-volt-soft text-volt-deep">
              <PartyPopper size={18} />
            </span>
            <h2 className="mt-4 font-display text-[26px] font-bold leading-[1.15] text-ink sm:text-[30px]">
              {card.mode === "signup"
                ? `Welcome to Sparvic${card.name ? `, ${card.name}` : ""}!`
                : `Welcome back${card.name ? `, ${card.name}` : ""}.`}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/65">
              {card.mode === "signup"
                ? "You're registered — one of the first on court. Add a photo and your level so other players can find you, then go say hello to the community."
                : "Good to see you. Catch up on who's new in the community, or give your profile a refresh."}
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button type="button" onClick={() => go("/dashboard/profile")} className="btn-volt">
                {card.mode === "signup" ? "Complete my profile" : "My profile"} <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => go("/players")} className="btn-outline">
                <Users size={16} /> Discover players
              </button>
            </div>
            <button type="button" onClick={close} className="mt-4 text-[12px] text-ink/45 underline hover:text-ink">
              Maybe later
            </button>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-volt-soft text-volt-deep">
              <Quote size={16} />
            </span>
            <blockquote className="mt-4 font-display text-[22px] leading-[1.25] text-ink sm:text-[26px]">
              {card.quote.line}
            </blockquote>
            <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45">
              {card.quote.who}
            </figcaption>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={close} className="text-[12px] text-ink/45 underline hover:text-ink">
                Dismiss
              </button>
              <span className="font-mono text-[10px] text-ink/35">Esc to dismiss</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

