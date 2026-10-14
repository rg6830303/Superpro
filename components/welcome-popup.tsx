"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, PartyPopper, Quote, Users, X } from "lucide-react";
import { INTRO_DONE_EVENT } from "@/components/smash-intro";
import { introHasFinished } from "@/lib/intro-once";

/**
 * Two cards, never both on one visit.
 *
 *   greeting — straight after sign-up or sign-in (the auth forms add
 *              `?welcome=signup|login` to the redirect and stash the first
 *              name in sessionStorage). Shown almost at once, with the next
 *              step for a new player; the query param is then stripped so a
 *              refresh or a shared link does not greet again.
 *   quote    — a single line worth reading, five seconds into a visit, once
 *              per tab session. It waits for the intro film to finish.
 */

const SEEN_KEY = "superpro:welcome-seen";
const NAME_KEY = "superpro:welcome-name";
const QUOTE_AT_KEY = "sparvic:quote-at";
const QUOTE_GAP_MS = 2 * 60 * 1000;

/** Just long enough for the page to paint first, so the card lands on a finished page. */
const DELAY_MS = 600;

/** Next quote from a per-browser shuffled deck, so none repeats until all have shown. */
function nextQuote() {
  const KEY = "sparvic:quote-deck";
  let deck: number[] = [];
  try { deck = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch {}
  deck = deck.filter((i) => Number.isInteger(i) && i >= 0 && i < QUOTES.length);
  if (!deck.length) {
    deck = QUOTES.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  }
  const idx = deck.shift() as number;
  try { localStorage.setItem(KEY, JSON.stringify(deck)); } catch {}
  return QUOTES[idx];
}

const QUOTES = [
  { line: "The ball does not care how you felt about the last point.", who: "Court wisdom" },
  { line: "Good players win rallies. Great players win the third shot.", who: "Sparvic coaches" },
  { line: "Dink like you have all day. Smash like you have one chance.", who: "Court wisdom" },
  { line: "You do not rise to the level of your paddle. You fall to the level of your footwork.", who: "Sparvic coaches" },
  { line: "Every regular on this court was once the newest player on it.", who: "Sparvic Kolkata" },
  { line: "Patience at the kitchen line wins more points than power from the baseline.", who: "Sparvic coaches" },
  { line: "Reset, breathe, go again.", who: "Court wisdom" },
  { line: "The best shot is the one your opponent did not expect.", who: "Court wisdom" },
  { line: "Soft hands, quick feet, calm mind.", who: "Sparvic coaches" },
  { line: "Play the ball, not the scoreboard.", who: "Court wisdom" },
  { line: "Your partner's confidence is a shot you can play too.", who: "Sparvic Kolkata" },
  { line: "Get to the kitchen. Good things happen there.", who: "Sparvic coaches" },
  { line: "Miss long? Aim lower. Miss in the net? Lift. Keep learning.", who: "Sparvic coaches" },
  { line: "One more rally is always worth it.", who: "Sparvic Kolkata" },
  { line: "Champions are just players who kept showing up.", who: "Court wisdom" },
  { line: "The third shot drop is a promise to be patient.", who: "Sparvic coaches" },
  { line: "Win or learn. There is no lose.", who: "Court wisdom" },
  { line: "Ready position is a habit, not a moment.", who: "Sparvic coaches" },
  { line: "A smile at 0–5 is the start of a comeback.", who: "Sparvic Kolkata" },
  { line: "Keep your paddle up and your excuses down.", who: "Court wisdom" },
  { line: "Every dink is a conversation. Listen to the reply.", who: "Sparvic coaches" },
  { line: "Small court. Big friendships.", who: "Sparvic Kolkata" },
  { line: "Footwork first, fancy shots later.", who: "Sparvic coaches" },
  { line: "The net is a teacher. It tells you exactly what to fix.", who: "Court wisdom" },
  { line: "Hit to the feet, win the point.", who: "Sparvic coaches" },
  { line: "Calm is contagious. So is panic. Choose calm.", who: "Court wisdom" },
  { line: "Your best game is the next one.", who: "Sparvic Kolkata" },
  { line: "Serve deep, return deep, then move in.", who: "Sparvic coaches" },
  { line: "Pressure is a privilege. It means the point matters.", who: "Court wisdom" },
  { line: "Talk to your partner. Silence loses middles.", who: "Sparvic coaches" },
  { line: "The kitchen line is where games are decided.", who: "Court wisdom" },
  { line: "Practice the boring shots. They win the exciting matches.", who: "Sparvic coaches" },
  { line: "Every expert dinked into the net a thousand times.", who: "Court wisdom" },
  { line: "Good sport first. Good player second. Both is best.", who: "Sparvic Kolkata" },
  { line: "Lob rarely, but lob well.", who: "Sparvic coaches" },
  { line: "Make them hit one more ball.", who: "Court wisdom" },
  { line: "Rest is training too.", who: "Sparvic coaches" },
  { line: "Same court, same time tomorrow?", who: "Sparvic Kolkata" },
  { line: "Slow the ball down to speed your game up.", who: "Sparvic coaches" },
  { line: "Respect every opponent. Fear none.", who: "Court wisdom" },
  { line: "Paddle face controls everything. Feel it.", who: "Sparvic coaches" },
  { line: "The comeback starts with the next serve.", who: "Court wisdom" },
  { line: "Learn one new shot this week.", who: "Sparvic coaches" },
  { line: "Pickleball is better with people you like. Find yours.", who: "Sparvic Kolkata" },
  { line: "Aim for the middle when in doubt.", who: "Sparvic coaches" },
  { line: "Stay low, stay ready, stay hungry.", who: "Court wisdom" },
  { line: "Celebrate the great shots, even the ones against you.", who: "Sparvic Kolkata" },
  { line: "Consistency beats brilliance over eleven points.", who: "Sparvic coaches" },
  { line: "You miss every drop you are afraid to try.", who: "Court wisdom" },
  { line: "Warm up the body, then warm up the mind.", who: "Sparvic coaches" },
  { line: "Kolkata plays with heart. Bring yours.", who: "Sparvic Kolkata" },
  { line: "The ball is coming back. Be ready when it does.", who: "Court wisdom" },
  { line: "Trust your partner. Cover your side.", who: "Sparvic coaches" },
  { line: "Leave the court better than you found it.", who: "Sparvic Kolkata" },
  { line: "A good loss teaches more than an easy win.", who: "Court wisdom" },
  { line: "Breathe out on contact.", who: "Sparvic coaches" },
  { line: "Every rating starts somewhere. Yours is just the start.", who: "Sparvic Kolkata" },
  { line: "Keep it low, keep it unattackable.", who: "Sparvic coaches" },
  { line: "Hustle is a skill.", who: "Court wisdom" },
  { line: "Have fun out there. That is the whole point.", who: "Sparvic Kolkata" },
];

function storage(fn: (s: Storage) => string | null | void): string | null {
  try {
    return fn(window.sessionStorage) ?? null;
  } catch {
    return null;
  }
}

/**
 * Where a pop-up is an interruption rather than a welcome: the coach portal is
 * a work tool, and checkout is the one screen where nothing should get between
 * a player and the pay button.
 */
const QUIET_PATHS = ["/coach", "/checkout", "/login", "/signup", "/forgot-password", "/reset-password", "/coaching/register", "/coaching/registration", "/medical/appointment"];

type Card =
  | { kind: "greeting"; mode: "signup" | "login"; name: string | null }
  | { kind: "quote"; quote: (typeof QUOTES)[number] };

export function WelcomePopup({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const welcome = params.get("welcome");
  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || (demo && (pathname.startsWith("/games") || pathname.startsWith("/dashboard")));
  const [card, setCard] = useState<Card | null>(null);

  const close = useCallback(() => setCard(null), []);
  useEffect(() => {
    if (demo) setCard(null);
  }, [pathname, demo]);

  // Greeting: wins over everything else on this visit.
  useEffect(() => {
    if (welcome !== "signup" && welcome !== "login") return;
    const name = storage((s) => s.getItem(NAME_KEY));
    storage((s) => {
      s.removeItem(NAME_KEY);
      s.setItem(SEEN_KEY, "1");
    });
    const timer = window.setTimeout(() => setCard({ kind: "greeting", mode: welcome, name }), 450);
    // Strip the param without a navigation, so a refresh does not greet again.
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    return () => window.clearTimeout(timer);
  }, [welcome]);

  // Quote: a few seconds into a page, at most every two minutes, never where
  // it would be in the way.
  useEffect(() => {
    const recent = () => Date.now() - Number(storage((s) => s.getItem(QUOTE_AT_KEY)) ?? 0) < QUOTE_GAP_MS;
    if (quiet || welcome || recent()) return;
    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (recent()) return;
        storage((s) => s.setItem(QUOTE_AT_KEY, String(Date.now())));
        setCard({ kind: "quote", quote: nextQuote() });
      }, demo ? 7000 : DELAY_MS);
    };
    // Pages under this layout never carry the intro, so start the timer now;
    // the event only matters if an intro is actually on screen.
    const introOnScreen = !introHasFinished() && Boolean(document.querySelector("video"));
    if (!introOnScreen) arm();
    window.addEventListener(INTRO_DONE_EVENT, arm);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(INTRO_DONE_EVENT, arm);
    };
  }, [quiet, welcome, demo, pathname]);

  // Quotes are a passing moment, not a task: they leave on their own after 2.5 s.
  useEffect(() => {
    if (card?.kind !== "quote") return;
    const t = window.setTimeout(close, 2500);
    return () => window.clearTimeout(t);
  }, [card, close]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, close]);

  if (!card || (quiet && card.kind === "quote")) return null;
  // On the demo the website is the guest view: the named greeting belongs to the clubhouse.
  if (demo && card.kind === "greeting" && !pathname.startsWith("/dashboard")) return null;

  const go = (href: string) => {
    close();
    router.push(href);
  };

  // Every quote, on every domain, is the same small self-closing toast.
  if (card.kind === "quote") return (
    <aside className="quote-toast" role="status" aria-label="Court inspiration" onClick={close}>
      <p className="quote-toast-label">A LITTLE COURT ENERGY</p>
      <p className="quote-toast-line">{card.quote.line}</p>
      <p className="quote-toast-who">{card.quote.who}</p>
      <span className="quote-toast-timer" aria-hidden="true" />
    </aside>
  );

  if (demo) return (
    <aside className="demo-welcome" aria-label={card.kind === "greeting" ? "Welcome to the club" : "Court inspiration"}>
      <button type="button" className="demo-welcome-close" onClick={close} aria-label="Dismiss message"><X size={18} /></button>
      <div className="demo-welcome-symbol" aria-hidden="true">{card.kind === "greeting" ? <PartyPopper size={23} /> : <Quote size={23} />}</div>
      <p className="demo-nav-label">{card.kind === "greeting" ? "YOU’RE IN GOOD COMPANY" : "A LITTLE COURT ENERGY"}</p>
      <div aria-live="polite">
        <h2>{card.kind === "greeting" ? `Welcome${card.mode === "login" ? " back" : " to the club"}${card.name ? `, ${card.name}` : ""}.` : ""}</h2>
        <p>{card.kind === "greeting" ? "Your people, your next game, your own corner of the club. Make yourself at home." : ""}</p>
      </div>
      <div className="demo-welcome-actions">{card.kind === "greeting" ? <button className="btn-volt btn-sm" onClick={() => go(card.mode === "signup" ? "/dashboard/profile" : "/dashboard")}>{card.mode === "signup" ? "Set up my profile" : "My clubhouse"}<ArrowRight size={15} /></button> : <button className="btn-volt btn-sm" onClick={close}>Let’s play <ArrowRight size={15} /></button>}<button className="demo-text-button" onClick={close}>Dismiss</button></div>
    </aside>
  );

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label={card.kind === "greeting" ? "Welcome" : "A word before you play"}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={close}
        className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px] animate-fade-in"
      />

      <div className="animate-pop-in relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-30px_rgba(6,38,61,0.5)]">
        <div className="h-1.5 w-full bg-volt" />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-4 rounded-full p-2 text-ink/40 transition-colors hover:bg-mist hover:text-ink"
        >
          <X size={16} />
        </button>

        {card.kind === "greeting" ? (
          <div className="p-6 sm:p-8">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-volt-soft text-volt-deep">
              <PartyPopper size={18} />
            </span>
            <h2 className="mt-4 font-display text-[26px] font-bold leading-[1.15] text-ink sm:text-[30px]">
              {card.mode === "signup"
                ? `Welcome to Sparvic${card.name ? `, ${card.name}` : ""}!`
                : `Welcome back${card.name ? `, ${card.name}` : ""}.`}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/65">
              {card.mode === "signup"
                ? "You're registered — one of the first on court. Add a photo and your level so other players can find you, then go say hello to the community."
                : "Good to see you. Catch up on who's new in the community, or give your profile a refresh."}
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button type="button" onClick={() => go("/dashboard/profile")} className="btn-volt">
                {card.mode === "signup" ? "Complete my profile" : "My profile"} <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => go("/players")} className="btn-outline">
                <Users size={16} /> Discover players
              </button>
            </div>
            <button type="button" onClick={close} className="mt-4 text-[12px] text-ink/45 underline hover:text-ink">
              Maybe later
            </button>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-volt-soft text-volt-deep">
              <Quote size={16} />
            </span>
            <blockquote className="mt-4 font-display text-[22px] leading-[1.25] text-ink sm:text-[26px]">
              {""}
            </blockquote>
            <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45">
              {""}
            </figcaption>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={close} className="text-[12px] text-ink/45 underline hover:text-ink">
                Dismiss
              </button>
              <span className="font-mono text-[10px] text-ink/35">Esc to dismiss</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

