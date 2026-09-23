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

/**
 * The same visit, in memory: sessionStorage answers "has this tab seen it",
 * these two answer "is the entrance playing right now", which the welcome card
 * needs in order to wait its turn.
 */
let playedInMemory = false;
let finishedInMemory = false;

export function introHasFinished(): boolean { return finishedInMemory; }
export function markIntroFinished(): void { finishedInMemory = true; }

/** Storage access throws in some privacy modes; a failure must never gate the site. */
export function introAlreadyPlayed(): boolean {
  if (playedInMemory) return true;
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroPlayed(): void {
  playedInMemory = true;
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* Private mode: the entrance simply plays again next load. */
  }
}
