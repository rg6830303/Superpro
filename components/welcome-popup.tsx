"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Quote, X } from "lucide-react";

/**
 * A quote card, five seconds into the visit.
 *
 * It used to be a menu of five destinations, which asked the visitor to make a
 * decision before they had seen anything — the nav already answers that. What
 * is left is a single line worth reading and a way to dismiss it: no links, no
 * redirects, nothing that moves the page out from under anyone.
 *
 * It is gated on sessionStorage rather than a per-load flag, so a refresh does
 * not reopen a card the visitor has already closed, and it clears with the tab.
 */

const SEEN_KEY = "superpro:welcome-seen";

/** How long the page is left alone before the card appears. */
const DELAY_MS = 5000;

const QUOTES = [
  { line: "The ball does not care how you felt about the last point.", who: "Court wisdom" },
  { line: "Good players win rallies. Great players win the third shot.", who: "Sparvic coaches" },
  { line: "Dink like you have all day. Smash like you have one chance.", who: "Court wisdom" },
  { line: "You do not rise to the level of your paddle. You fall to the level of your footwork.", who: "Sparvic coaches" },
  { line: "Every regular on this court was once the newest player on it.", who: "Sparvic Kolkata" },
];

function seenThisVisit(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* Private mode: it opens again next load, which is the old behaviour. */
  }
}

/**
 * Where a motivational pop-up is an interruption rather than a welcome: the
 * coach portal is a work tool, and checkout is the one screen where nothing
 * should get between a player and the pay button.
 */
const QUIET_PATHS = ["/coach", "/checkout"];

export function WelcomePopup() {
  const pathname = usePathname();
  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [open, setOpen] = useState(false);
  // Chosen on the client, after mount: picking during render would have the
  // server and the browser disagree about which line to show.
  const [quote, setQuote] = useState<(typeof QUOTES)[number] | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (quiet || seenThisVisit()) return;
    const timer = window.setTimeout(() => {
      markSeen();
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [quiet]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (quiet || !open || !quote) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end justify-center p-4 sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-label="A word before you play"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={close}
        className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px] animate-fade-in"
      />

      <div className="animate-pop-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-30px_rgba(6,38,61,0.5)]">
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
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-volt-soft text-volt-deep">
            <Quote size={16} />
          </span>

          <blockquote className="mt-4 font-display text-[22px] leading-[1.25] text-ink sm:text-[26px]">
            {quote.line}
          </blockquote>
          <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45">
            {quote.who}
          </figcaption>

          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={close} className="text-[12px] text-ink/45 underline hover:text-ink">
              Dismiss
            </button>
            <span className="font-mono text-[10px] text-ink/35">Esc to dismiss</span>
          </div>
        </div>
      </div>
    </div>
  );
}
