"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { INTRO_SEEN_KEY, introAlreadyPlayed, markIntroPlayed } from "@/lib/intro-once";

/**
 * Mounts the Three.js smash entrance.
 *
 * It plays once per visit — the first page opened in a tab — and then stands
 * down: refreshes, back-navigation and moving between pages get the site
 * directly. A signup or sign-in (which arrive carrying `?welcome=`) is the one
 * thing that earns a replay, because there is something to celebrate.
 *
 * Three.js is behind a dynamic import so it never lands in the server bundle or
 * the first-load payload, and it is not fetched at all on the visits that will
 * not play it — which is the majority of them.
 */

/** Broadcast so the welcome card can wait its turn instead of overlapping. */
export const INTRO_DONE_EVENT = "superpro:intro-done";

function announceDone() {
  window.dispatchEvent(new CustomEvent(INTRO_DONE_EVENT));
}

/**
 * Lift the server-rendered cover. Called only once the scene has actually put a
 * frame on screen, so the two never both step aside and reveal the page.
 */
type BootCoverApi = { __superproBootClear?: () => void; __superproBootHold?: (ms: number) => void };

function clearBootCover() {
  (window as unknown as BootCoverApi).__superproBootClear?.();
}

/**
 * How long the cover is allowed to hold while the scene loads. Past this, the
 * entrance is abandoned for this visit: on a slow connection a visitor is far
 * better served by the site than by a logo they are made to watch, and starting
 * the animation after they have begun reading is worse than not playing it.
 */
const LOAD_BUDGET_MS = 2600;

function holdBootCover() {
  (window as unknown as BootCoverApi).__superproBootHold?.(LOAD_BUDGET_MS);
}

export function SmashIntro() {
  const params = useSearchParams();
  const welcome = params.get("welcome");

  useEffect(() => {
    let cancelled = false;
    let api: { play(): void; dispose(): void; duration: number } | null = null;

    const celebrating = welcome === "signup" || welcome === "login";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reasons not to play, in the order they are cheapest to check. Each one
    // returns without importing Three.js, so the scene's weight is never paid
    // by a visitor who will not see it — reduced-motion users included, who
    // previously downloaded and built the whole thing for nothing.
    if ((introAlreadyPlayed() && !celebrating) || reduced || typeof WebGLRenderingContext === "undefined") {
      markIntroPlayed();
      clearBootCover();
      announceDone();
      return;
    }

    // Claimed up front, not after the scene paints: a refresh mid-animation, or
    // an effect that re-runs during hydration, must not start a second one.
    markIntroPlayed();

    // Tell the cover to wait: it has its own timer, and without this it would
    // lift on schedule and show the page moments before the scene paints.
    holdBootCover();
    const deadline = Date.now() + LOAD_BUDGET_MS;

    import("@/lib/intro/scene")
      .then((mod) => mod.createIntro())
      .then((created) => {
        // Too late to be an entrance. The cover has already lifted and the
        // visitor is looking at the page; dropping an animation over it now
        // would be worse than the flash this all exists to prevent.
        if (cancelled || Date.now() > deadline) {
          created.dispose();
          clearBootCover();
          announceDone();
          return;
        }
        api = created;
        created.play();

        // Hand off only once the scene has genuinely painted. Two frames: the
        // first schedules the render, the second lands after it.
        requestAnimationFrame(() => requestAnimationFrame(clearBootCover));
        window.setTimeout(announceDone, created.duration * 1000);
      })
      .catch((err) => {
        console.error("[intro] could not start:", err);
        clearBootCover();
        announceDone();
      });

    return () => {
      cancelled = true;
      api?.dispose();
    };
    // Only the welcome flag. `pathname` used to be here, which re-ran the whole
    // effect — and re-fired the done event — on every client-side navigation.
  }, [welcome]);

  return null;
}

export { INTRO_SEEN_KEY };
