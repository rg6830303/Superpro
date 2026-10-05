"use client";

import { useEffect, useState } from "react";

/**
 * Hours, minutes and seconds until the launch.
 *
 * Hours are not folded into days: the brief is a running clock, and 216:04:09
 * reads as one number counting down where "9d 0h 4m" reads as three.
 *
 * The first render is computed from the server's clock, so the HTML a visitor
 * receives already shows the right time, and hydration matches it exactly.
 * After mount the clock keeps the *server's* idea of the time — the offset
 * between it and the device clock is taken once — so a phone whose clock is
 * minutes out does not shift the launch. The offset ignores the short trip
 * from server to browser, which leaves the display a second or two behind;
 * over ten days that is noise, and the safe direction to be wrong in.
 *
 * Every tick is recomputed from the clock rather than counted, so a throttled
 * background tab or a sleeping laptop is correct the moment it wakes.
 */
export function LaunchCountdown({ target, serverNow }: { target: number; serverNow: number }) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const offset = serverNow - Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const current = Date.now() + offset;
      setNow(current);
      if (current >= target) return; // At zero it stops; nothing left to count.
      // Aim just past the next whole second. Landing a few ms early would
      // repeat the previous number for another second.
      timer = setTimeout(tick, 1000 - (current % 1000) + 20);
    };
    tick();

    // Timers in a hidden tab are slowed to a crawl; catch up on return.
    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [serverNow, target]);

  const remaining = target - now;
  const done = remaining <= 0;
  // Rounded up so the clock reads 00:00:00 at the launch, not a second before.
  const total = Math.max(0, Math.ceil(remaining / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return (
    <section aria-label="Launch countdown" className="text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#dee672]">
        {done ? "Launch day" : "Launching on"}
        {/* A deliberate second line on a phone, inline from `sm` up — left to
            wrap on its own it strands "IST" alone on the next line at 360px. */}
        <span className="mt-1.5 block text-white/45 sm:mt-0 sm:inline">
          <span className="hidden sm:inline"> · </span>
          15 Oct 2026, 12:00 AM IST
        </span>
      </p>

      {done ? (
        <p className="mt-3 font-display text-3xl font-bold text-white sm:text-5xl">It&apos;s here.</p>
      ) : (
        <div aria-hidden className="mt-3 flex items-start justify-center gap-1.5 sm:gap-3">
          <Unit value={hours} label="Hours" min={2} />
          <Colon />
          <Unit value={minutes} label="Minutes" min={2} />
          <Colon />
          <Unit value={seconds} label="Seconds" min={2} />
        </div>
      )}

      {/* The ticking digits are hidden from assistive tech on purpose: a live
          region that changes every second is unusable. This says the one thing
          that matters, once. */}
      <p className="sr-only">Launching at midnight India Standard Time, 15 October 2026.</p>
    </section>
  );
}

function Unit({ value, label, min }: { value: number; label: string; min: number }) {
  const text = String(value).padStart(min, "0");
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-3 backdrop-blur-sm sm:px-4">
      <div className="flex font-display text-[clamp(2rem,9.5vw,3rem)] font-bold leading-none text-white">
        {/* One fixed-width cell per digit, so a "1" does not narrow the box and
            the clock never shifts sideways as it counts. */}
        {text.split("").map((digit, i) => (
          <span key={i} className="inline-block w-[0.64em] text-center">
            {digit}
          </span>
        ))}
      </div>
      <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">{label}</span>
    </div>
  );
}

function Colon() {
  return (
    <span className="pt-2 font-display text-[clamp(1.5rem,7vw,2.25rem)] font-bold leading-none text-[#dee672]/60 sm:pt-2.5">
      :
    </span>
  );
}
