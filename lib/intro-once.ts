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
/** When the entrance last played, in localStorage: at most once a week. */
export const INTRO_LAST_KEY = "superpro:intro-last";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
/**
 * True when the entrance should NOT play: already shown this tab or this week,
 * or the visit did not land on the home page — deep links go straight to the
 * page asked for. Mirrors the gate script in components/boot-cover.tsx.
 */
export function introAlreadyPlayed(): boolean {
  if (playedInMemory) return true;
  if (window.location.pathname !== "/") return true;
  try {
    if (window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1") return true;
  } catch {
    /* storage blocked */
  }
  try {
    const last = Number(window.localStorage.getItem(INTRO_LAST_KEY) ?? 0);
    if (Date.now() - last < WEEK_MS) return true;
  } catch {
    /* storage blocked */
  }
  return false;
}

/** `shown` starts the once-a-week clock; only a real showing should do that. */
export function markIntroPlayed(shown = false): void {
  playedInMemory = true;
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    if (shown) window.localStorage.setItem(INTRO_LAST_KEY, String(Date.now()));
  } catch {
    /* Private mode: the entrance simply plays again next load. */
  }
}
