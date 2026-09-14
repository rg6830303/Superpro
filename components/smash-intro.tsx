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
      announceDone();
      return;
    }

    // Nothing to show on a screen that cannot paint it.
    if (typeof WebGLRenderingContext === "undefined") {
      announceDone();
      return;
    }

    const timer = window.setTimeout(() => {
      import("@/lib/intro/scene")
        .then(mod => mod.createIntro())
        .then(created => {
          if (cancelled) {
            created.dispose();
            return;
          }
          api = created;
          // Marked here rather than up front: this effect can be torn down and
          // re-run during hydration, and claiming the slot before the scene is
          // actually on screen would make the second pass skip it entirely.
          playedThisLoad = true;
          created.play();
          // The scene clears itself; this is the cue for everything downstream.
          window.setTimeout(announceDone, created.duration * 1000);
        })
        .catch(err => {
          console.error("[intro] could not start:", err);
          announceDone();
        });
      // One frame of delay so the header logo has mounted and measured.
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      api?.dispose();
    };
    // Keyed on the route so a post-auth redirect retriggers it, and on nothing
    // else — this must not replay on every render.
  }, [welcome, pathname]);

  return null;
}
