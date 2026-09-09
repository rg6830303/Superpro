"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The motion toolkit. Everything here is hand-rolled on IntersectionObserver,
 * CSS transforms and requestAnimationFrame — no animation library — so the
 * bundle stays small and the timing curves match the ones in globals.css
 * instead of a vendor's defaults.
 *
 * Every component degrades to a plain, fully visible element when
 * prefers-reduced-motion is set or JavaScript has not run.
 */

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Reveal on first scroll into view. Runs once — nothing re-animates on scroll-back. */
export function Reveal({
  children,
  delay = 0,
  variant = "up",
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: "up" | "left" | "scale";
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        window.setTimeout(() => el.classList.add("is-in"), delay);
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  const variantClass = variant === "left" ? "enter-left" : variant === "scale" ? "enter-scale" : "";

  return (
    <Tag ref={ref as never} className={`enter ${variantClass} ${className}`}>
      {children}
    </Tag>
  );
}

/**
 * Pointer-tracked 3D tilt. The card leans toward the cursor and lifts a
 * highlight layer on a separate Z plane, so the parallax is real depth rather
 * than a scale transform pretending to be one.
 */
export function TiltCard({
  children,
  className = "",
  max = 9,
  glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    // Touch pointers have no hover state, so tilt would only fire mid-tap.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    function apply(x: number, y: number) {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (x - r.left) / r.width - 0.5;
      const py = (y - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-py * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(px * max).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
    }

    function onMove(e: PointerEvent) {
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => apply(e.clientX, e.clientY));
    }
    function onLeave() {
      const el = ref.current;
      if (!el) return;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [max]);

  return (
    <div className="scene">
      <div
        ref={ref}
        className={`preserve-3d relative transition-transform duration-300 ease-out ${className}`}
        style={{ transform: "rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))" }}
      >
        {children}
        {glare && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 [background:radial-gradient(circle_at_var(--gx,50%)_var(--gy,50%),rgba(255,255,255,0.55),transparent_55%)] group-hover:opacity-100"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Counts up to a number when it scrolls into view. Uses the same easing as the
 * reveal so a stat block and its container feel like one movement.
 */
export function Counter({
  to,
  duration = 1100,
  suffix = "",
  prefix = "",
  className = "",
}: {
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setValue(to);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // Same cubic-bezier(0.16,1,0.3,1) shape as the CSS reveals.
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(to * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={`tnum ${className}`}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

/**
 * A confetti burst, drawn with the palette rather than a rainbow. Fires once
 * per `trigger` change and cleans itself up, so a confirmation screen can
 * celebrate without leaving DOM behind.
 */
export function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; dx: number; delay: number; color: string }>>([]);

  useEffect(() => {
    if (!trigger || prefersReducedMotion()) return;
    const palette = ["#00E55F", "#06263D", "#5BFF9C", "#10527E"];
    const next = Array.from({ length: 26 }, (_, i) => ({
      id: trigger * 100 + i,
      left: Math.random() * 100,
      dx: (Math.random() - 0.5) * 220,
      delay: Math.random() * 260,
      color: palette[i % palette.length],
    }));
    setPieces(next);
    const timer = window.setTimeout(() => setPieces([]), 2200);
    return () => window.clearTimeout(timer);
  }, [trigger]);

  if (pieces.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}ms`,
            ["--dx" as string]: `${p.dx}px`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Ball that bounces on a court line — the site's fidget. It reacts to a click
 * with a harder bounce, which is the whole joke: it is a toy, so it should do
 * something when you poke it.
 */
export function BounceBall({ size = 34, className = "" }: { size?: number; className?: string }) {
  const [kick, setKick] = useState(0);

  return (
    <button
      type="button"
      onClick={() => setKick((k) => k + 1)}
      aria-label="Bounce the ball"
      className={`group relative inline-flex items-end justify-center ${className}`}
      style={{ width: size + 12, height: size + 46 }}
    >
      <span
        key={kick}
        className="absolute left-1/2 -translate-x-1/2 animate-ball-bounce rounded-full border-2 border-ink/15 bg-volt"
        style={{ width: size, height: size, bottom: 10, animationDuration: kick ? "0.75s" : "1.5s" }}
      >
        {/* The 40 holes of an outdoor ball, abbreviated to a readable four. */}
        <span className="absolute left-[22%] top-[26%] h-1 w-1 rounded-full bg-ink/25" />
        <span className="absolute right-[24%] top-[34%] h-1 w-1 rounded-full bg-ink/25" />
        <span className="absolute left-[34%] bottom-[24%] h-1 w-1 rounded-full bg-ink/25" />
        <span className="absolute right-[32%] bottom-[30%] h-1 w-1 rounded-full bg-ink/25" />
      </span>
      <span className="absolute bottom-2 h-[3px] w-full rounded-full bg-ink/12" />
    </button>
  );
}

/**
 * Progress meter shaped like a scoreboard — used for stock, capacity and the
 * tournament draw, so "how full is this" reads the same way everywhere.
 */
export function ScoreMeter({
  value,
  max,
  label,
  tone = "volt",
}: {
  value: number;
  max: number;
  label?: string;
  tone?: "volt" | "warn";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(pct);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      window.setTimeout(() => setShown(pct), 80);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [pct]);

  return (
    <div ref={ref}>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="kicker">{label}</span>
          <span className="font-mono text-[11px] tabular-nums text-ink/60">
            {value}/{max}
          </span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist-deep">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            tone === "warn" ? "bg-amber" : "bg-volt"
          }`}
          style={{ width: `${shown}%` }}
        />
      </div>
    </div>
  );
}
