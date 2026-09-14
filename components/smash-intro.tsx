"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Mounts the Three.js smash entrance.
 *
 * Plays on a hard page load or refresh, and again right after a signup or
 * sign-in (which arrive carrying `?welcome=`). It deliberately does not replay
 * on client-side navigation — this component lives in the site layout, so it
 * survives route changes rather than remounting on each one.
 *
 * Three.js is behind a dynamic import so it never lands in the server bundle or
 * the first-load payload; the page is interactive while the scene is still
 * fetching, and a failure to load leaves the site exactly as it was.
 */

/** Broadcast so the welcome card can wait its turn instead of overlapping. */
export const INTRO_DONE_EVENT = "superpro:intro-done";

/**
 * Module scope, not sessionStorage, is exactly the lifetime wanted here: it
 * survives client-side navigation inside one page load and resets on a real
 * refresh. So the entrance plays every time the site is opened or reloaded,
 * and never again while the visitor moves between tabs of the same session.
 */
let playedThisLoad = false;

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
  const pathname = usePathname();
  const params = useSearchParams();
  const welcome = params.get("welcome");

  useEffect(() => {
    let cancelled = false;
    let api: { play(): void; dispose(): void; duration: number } | null = null;

    // A signup or sign-in always earns a replay. Otherwise this runs once per
    // page load, which is what a refresh is.
    const celebrating = welcome === "signup" || welcome === "login";
    if (!celebrating && playedThisLoad) {
      clearBootCover();
      announceDone();
      return;
    }

    // Nothing to show on a screen that cannot paint it.
    if (typeof WebGLRenderingContext === "undefined") {
      clearBootCover();
      announceDone();
      return;
    }

    // Tell the cover to wait: it has its own timer, and without this it would
    // lift on schedule and show the page moments before the scene paints.
    holdBootCover();
    const deadline = Date.now() + LOAD_BUDGET_MS;

    // Started immediately rather than on a timer: the cover is holding the
    // screen, so every millisecond here is a millisecond of blank branding.
    // The scene waits for the header logo itself.
    import("@/lib/intro/scene")
      .then(mod => mod.createIntro())
      .then(created => {
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
        // Marked here rather than up front: this effect can be torn down and
        // re-run during hydration, and claiming the slot before the scene is
        // actually on screen would make the second pass skip it entirely.
        playedThisLoad = true;
        created.play();

        // Hand off only once the scene has genuinely painted. Two frames:
        // the first schedules the render, the second is after it has landed.
        // Lifting the cover any earlier puts the home page back on screen for
        // exactly the blink this whole mechanism exists to remove.
        requestAnimationFrame(() => requestAnimationFrame(clearBootCover));

        // The scene clears itself; this is the cue for everything downstream.
        window.setTimeout(announceDone, created.duration * 1000);
      })
      .catch(err => {
        console.error("[intro] could not start:", err);
        clearBootCover();
        announceDone();
      });

    return () => {
      cancelled = true;
      api?.dispose();
    };
    // Keyed on the route so a post-auth redirect retriggers it, and on nothing
    // else — this must not replay on every render.
  }, [welcome, pathname]);

  return null;
}
