/**
 * One entrance per visit.
 *
 * The smash animation used to be gated on a module-scope flag, which lasts
 * exactly as long as one page load — so every refresh, every return to the tab
 * and every visit replayed the full-screen cover and the Three.js scene. It is
 * an entrance; it should introduce the site once and then get out of the way.
 *
 * sessionStorage is the right lifetime: it survives refreshes and navigation
 * within the visit, and clears when the tab closes, so someone coming back
 * tomorrow is welcomed again.
 *
 * The same key is read by the server-rendered boot cover's inline script, which
 * runs before this module is parsed — keep the string in step with it.
 */
export const INTRO_SEEN_KEY = "superpro:intro-seen";

/** Storage access throws in some privacy modes; a failure must never gate the site. */
export function introAlreadyPlayed(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroPlayed(): void {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* Private mode: the entrance simply plays again next load. */
  }
}
