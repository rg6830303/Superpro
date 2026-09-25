"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { introAlreadyPlayed, markIntroPlayed, markIntroFinished } from "@/lib/intro-once";
import { lockScroll } from "@/lib/scroll-lock";

export const INTRO_DONE_EVENT = "superpro:intro-done";
type BootCoverWindow = Window & { __superproBootClear?: () => void };

function clearBootCover() {
  (window as BootCoverWindow).__superproBootClear?.();
}

function announceDone() {
  markIntroFinished();
  window.dispatchEvent(new CustomEvent(INTRO_DONE_EVENT));
}

/**
 * A tab gets one entrance, including across refreshes and navigation. A signup
 * or sign-in (which arrives carrying `?welcome=`) earns a replay, because there
 * is something to celebrate.
 */
export function SmashIntro() {
  const params = useSearchParams();
  const welcome = params.get("welcome");
  const video = useRef<HTMLVideoElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);
  const guard = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fade = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [source, setSource] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    clearTimeout(guard.current);
    clearBootCover();
    setLeaving(true);
    fade.current = setTimeout(() => {
      setSource(null);
      announceDone();
    }, 240);
  }, []);

  useEffect(() => {
    // Defer the claim until setup survives React Strict Mode's cleanup/re-run.
    // A discarded setup must not consume the first visit or remove its timers.
    const start = setTimeout(() => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      const celebrating = welcome === "signup" || welcome === "login";
      if ((introAlreadyPlayed() && !celebrating) || window.matchMedia("(prefers-reduced-motion: reduce)").matches || connection?.saveData) {
        markIntroPlayed();
        clearBootCover();
        announceDone();
        return;
      }
      markIntroPlayed(true);
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      setSource(`/intro/kolkata-smash-${portrait ? "mobile" : "desktop"}.mp4`);
    }, 0);
    return () => {
      clearTimeout(start);
      clearTimeout(guard.current);
      clearTimeout(fade.current);
    };
  }, [welcome]);

  useEffect(() => {
    if (!source || !video.current) return;
    const player = video.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const content = document.querySelector<HTMLElement>("[data-site-content]");
    const wasInert = content?.inert ?? false;
    const unlock = lockScroll();
    if (content) content.inert = true;
    skip.current?.focus({ preventScroll: true });
    let disposed = false;
    // Mobile data or blocked autoplay must never leave a blank screen waiting.
    guard.current = setTimeout(finish, 1800);
    player.muted = true;
    player.defaultMuted = true;
    player.play()?.catch(() => { if (!disposed) finish(); });
    return () => {
      disposed = true;
      clearTimeout(guard.current);
      player.pause();
      unlock();
      if (content) content.inert = wasInert;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [source, finish]);

  if (!source) return null;

  return (
    <div
      data-intro
      className={`fixed inset-0 z-[2147483600] overflow-hidden bg-[#031622] transition-opacity duration-200 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
      role="dialog"
      aria-label="SuperPro opening animation"
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") finish();
        if (event.key === "Tab") { event.preventDefault(); skip.current?.focus(); }
      }}
    >
      <video
        ref={video}
        src={source}
        className="h-full w-full object-contain"
        aria-hidden="true"
        tabIndex={-1}
        autoPlay muted playsInline preload="auto" disablePictureInPicture
        onPlaying={() => {
          if (finished.current) return;
          clearBootCover();
          clearTimeout(guard.current);
          guard.current = setTimeout(finish, 4600);
        }}
        onEnded={finish}
        onError={finish}
      />
      <button
        ref={skip}
        type="button"
        onClick={finish}
        className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] min-h-11 min-w-20 rounded-full border border-white/30 bg-[#031622]/80 px-5 py-3 text-sm font-medium text-white backdrop-blur-md hover:border-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e575]"
      >Skip</button>
    </div>
  );
}
