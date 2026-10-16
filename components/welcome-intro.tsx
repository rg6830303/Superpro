"use client";

import { useEffect, useRef, useState } from "react";
import { INTRO_DONE_EVENT } from "@/components/smash-intro";
import { markIntroFinished } from "@/lib/intro-once";

/** Widescreen for laptops, a vertical cut for phones held upright. */
export const welcomeFilm = (portrait: boolean) =>
  portrait
    ? { src: "/intro/sparvic-welcome-mobile.mp4", poster: "/intro/sparvic-welcome-mobile-poster.jpg" }
    : { src: "/intro/sparvic-welcome.mp4", poster: "/intro/sparvic-welcome-poster.jpg" };
export const isPortrait = () => window.matchMedia("(max-aspect-ratio: 4/5)").matches;

/**
 * "Welcome to Sparvic": a full-screen opening film on the website.
 *
 * It is rendered from the very first paint (server and client agree on the
 * initial state), so the page never flashes before it. It belongs to the page
 * load, not to navigation: the shell that hosts it stays mounted while players
 * move between pages and tabs, so it plays again only on a refresh or a new
 * visit. It never appears inside the clubhouse, and players who prefer reduced
 * motion skip it.
 */
export function WelcomeIntro({ enabled }: { enabled: boolean }) {
  const [show, setShow] = useState(enabled);
  const [leaving, setLeaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const done = useRef(false);
  // Chosen on the client (screen shape is unknown to the server); the cover
  // itself is painted from the first frame either way.
  const [film, setFilm] = useState<{ src: string; poster: string } | null>(null);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(() => {
      setShow(false);
      markIntroFinished();
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
    }, 550);
  };

  useEffect(() => {
    if (!show) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    setFilm(welcomeFilm(isPortrait()));
    // A stalled or blocked video must never trap the visitor.
    const safety = setTimeout(finish, 8000);
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter" || e.key === " ") && finish();
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      clearTimeout(safety);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  useEffect(() => {
    if (film) video.current?.play().catch(() => {});
  }, [film]);

  if (!show) return null;
  return (
    <div className={`welcome-intro ${leaving ? "is-leaving" : ""}`} role="dialog" aria-label="Welcome to Sparvic" onClick={finish}>
      <video
        ref={video}
        src={film?.src}
        poster={film?.poster}
        muted
        playsInline
        autoPlay
        preload="auto"
        onEnded={finish}
        onError={finish}
        aria-hidden="true"
      />
      <button type="button" className="welcome-intro-skip" onClick={(e) => { e.stopPropagation(); finish(); }}>
        Skip
      </button>
    </div>
  );
}
