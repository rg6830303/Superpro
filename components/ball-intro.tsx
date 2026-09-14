"use client";

import { useEffect, useState } from "react";

/**
 * The arrival animation.
 *
 * A pickleball fills the screen, then pulls back to reveal the page behind it —
 * the same move as a camera racking focus off the ball at the start of a rally.
 * Runs once per browser tab and never blocks input: the overlay is
 * pointer-events-none from the first frame, so a fast visitor can scroll
 * straight through it.
 */
const SEEN_KEY = "superpro:ball-intro";

export function BallIntro() {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Private browsing throws on access — treat it as a first visit.
    }
    if (reduced || seen) {
      setPhase("done");
      return;
    }

    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* nothing to do */
    }
    setPhase("playing");
    const t = setTimeout(() => setPhase("done"), 1250);
    return () => clearTimeout(t);
  }, []);

  if (phase !== "playing") return null;

  return (
    <div aria-hidden className="ball-intro pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-paper">
      <svg viewBox="0 0 100 100" className="ball-intro-ball h-[min(140vw,140vh)] w-[min(140vw,140vh)]">
        <circle cx="50" cy="50" r="48" fill="#00E55F" />
        {/* The 40 holes of an outdoor ball, laid out on three rings. */}
        {[
          { r: 16, n: 6, offset: 0 },
          { r: 29, n: 10, offset: 18 },
          { r: 40, n: 12, offset: 9 },
        ].flatMap((ring) =>
          Array.from({ length: ring.n }, (_, i) => {
            const angle = ((i * 360) / ring.n + ring.offset) * (Math.PI / 180);
            return (
              <circle
                key={`${ring.r}-${i}`}
                cx={50 + ring.r * Math.cos(angle)}
                cy={50 + ring.r * Math.sin(angle)}
                r={3.1}
                fill="#06263D"
                opacity={0.82}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}
