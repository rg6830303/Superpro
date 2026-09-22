"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, GraduationCap, Handshake, ShoppingBag, Trophy, X } from "lucide-react";
import { Confetti } from "@/components/motion";
import { INTRO_DONE_EVENT } from "@/components/smash-intro";

/**
 * The card that opens behind the entrance, once per visit.
 *
 * It has one job: ask where the visitor is headed and get them there. It waits
 * for the entrance to finish so the two never overlap, and — like the entrance
 * — it is gated on sessionStorage rather than a per-load flag, so a refresh
 * does not reopen a dialog the visitor has already dismissed.
 *
 * A signup or sign-in replaces the menu with a short confirmation, which is the
 * one case where it is worth interrupting someone.
 */

const SEEN_KEY = "superpro:welcome-seen";

const GREETING = "Where do you want to start?";

const JOIN_LINES = ["You're in. Welcome to the club.", "Account live. Now go find a court."];
const BACK_LINES = ["Good to have you back.", "Back on court. Nice."];

const INTENTS = [
  { label: "Play today", href: "/games", icon: CalendarDays, note: "Daily games across Kolkata venues" },
  { label: "Buy gear", href: "/products", icon: ShoppingBag, note: "Champion Series paddles and balls" },
  { label: "Get coaching", href: "/coaching", icon: GraduationCap, note: "Certified coaches and clinics" },
  { label: "Enter a tournament", href: "/tournaments", icon: Trophy, note: "Competitive draws and ladders" },
  { label: "Partner with us", href: "/about", icon: Handshake, note: "Franchise and investment" },
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

  const close = useCallback(() => {
    setOpen(false);
    if (welcome) {
      const rest = new URLSearchParams(params.toString());
      rest.delete("welcome");
      const q = rest.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [params, pathname, router, welcome]);

  useEffect(() => {
    const celebrating = welcome === "signup" || welcome === "login";
    if (!celebrating && seenThisVisit()) return;
    markSeen();

    setMode(celebrating ? (welcome as "signup" | "login") : "intent");

    let timer = 0;
    const show = () => {
      window.clearTimeout(timer);
      setOpen(true);
    };

    // Whichever comes first: the entrance finishing, or a ceiling on the wait
    // so a failed entrance never leaves the card unopened.
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
          <p className="eyebrow">
            {celebrating ? (mode === "signup" ? "Welcome aboard" : "Welcome back") : "SuperPro Pickleball"}
          </p>
          <h2 className="mt-2 font-display text-[24px] leading-[1.18] text-ink sm:text-[28px]">
            {celebrating ? celebrateLine : GREETING}
          </h2>

          {celebrating ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                {mode === "signup"
                  ? "Your wallet, bookings and player profile live in one place now. Keep your DUPR rating current for balanced draws."
                  : "Everything you booked is ready. Check the courts, or find other players."}
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
              <div className="mt-5 grid gap-2">
                {INTENTS.map((intent) => (
                  <Link
                    key={intent.href}
                    href={intent.href}
                    onClick={close}
                    className="group flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-volt-deep/40 hover:bg-mist"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mist text-volt-deep">
                      <intent.icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{intent.label}</span>
                      <span className="block truncate text-[11px] text-ink/50">{intent.note}</span>
                    </span>
                  </Link>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={close} className="text-[12px] text-ink/45 underline hover:text-ink">
                  Just looking around
                </button>
                <span className="font-mono text-[10px] text-ink/35">Esc to dismiss</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
