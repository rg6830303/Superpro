import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Heart, Play, Instagram, MessageCircle, Search, UserPlus, Users } from "lucide-react";
import { getPlayerSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { LaunchCountdown } from "@/components/launch-countdown";
import { LAUNCH_AT, SITE, waLink } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Sparvic — Coming soon" },
  description:
    "Kolkata's pickleball house is almost here. Register now to claim your player profile and meet the community first.",
  alternates: { canonical: "/" },
};

async function playerCount(): Promise<number> {
  try {
    await ensureSchema();
    const row = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM users");
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** The line-wave edges from the intro film's closing frame. */
function Waves({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 220"
      preserveAspectRatio="none"
      className={`launch-waves pointer-events-none absolute inset-x-0 h-[22vh] min-h-[120px] w-full ${flip ? "top-0 rotate-180" : "bottom-0"}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <path
          key={i}
          d={`M0 ${120 + i * 11} C 240 ${60 + i * 9}, 480 ${190 + i * 4}, 720 ${130 + i * 8} S 1200 ${70 + i * 10}, 1440 ${140 + i * 7}`}
          fill="none"
          stroke="#3f7a4f"
          strokeOpacity={0.18 + i * 0.06}
          strokeWidth={1.4}
        />
      ))}
    </svg>
  );
}

const OUTLINE_BTN =
  "inline-flex w-full items-center justify-center gap-2 rounded-pill border border-white/30 px-6 py-3 text-sm font-semibold transition-colors hover:border-[#dee672] hover:text-[#dee672] sm:w-auto";

export default async function LaunchPage() {
  const [session, count] = await Promise.all([getPlayerSession(), playerCount()]);

  return (
    <main
      id="main-content"
      className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#05223c] text-white"
    >
      <style>{`
        .launch-stars span{position:absolute;border-radius:9999px;background:#dee672;animation:launch-twinkle 3.2s ease-in-out infinite}
        @keyframes launch-twinkle{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:.9;transform:scale(1)}}
        .launch-ball{animation:launch-bounce 1.8s cubic-bezier(.45,0,.55,1) infinite}
        @keyframes launch-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        .launch-title{background:linear-gradient(180deg,#ffffff 0%,#ffffff 55%,#e4ef9a 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 22px rgba(255,255,255,.28)) drop-shadow(0 0 60px rgba(162,195,109,.3))}
        .launch-rise{animation:launch-rise .9s cubic-bezier(.2,.7,.2,1) both}
        @keyframes launch-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        .launch-waves path{animation:launch-drift 9s ease-in-out infinite alternate}
        @keyframes launch-drift{to{transform:translateX(-40px)}}
        /* On a short laptop screen the generous top padding is what pushes the
           register button below the fold; there is nothing above it to earn it. */
        @media (min-width:640px) and (max-height:960px){.launch-body.launch-body{padding-top:2.5rem}.launch-body.launch-body img{width:150px}}
        @media (prefers-reduced-motion: reduce){
          .launch-stars span,.launch-ball,.launch-rise,.launch-waves path{animation:none}
        }
      `}</style>

      {/* Deep radial light behind the title. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,#0c3a5c_0%,#05223c_55%,#031627_100%)]"
      />
      <div aria-hidden className="launch-stars pointer-events-none absolute inset-0">
        {STARS.map(([x, y, s, d], i) => (
          <span key={i} style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${d}s` }} />
        ))}
      </div>
      <Waves flip />
      <Waves />

      <div className="launch-body relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-12 pt-10 text-center sm:py-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/sparvic-logo-white.png"
          alt="Sparvic"
          width={220}
          height={145}
          className="launch-rise h-auto w-[118px] drop-shadow-[0_0_28px_rgba(222,230,114,0.25)] sm:w-[190px]"
        />

        <h1
          className="launch-rise launch-title mt-5 font-display text-[clamp(2.9rem,13vw,7.8rem)] sm:mt-8 font-black uppercase leading-[0.88] tracking-tight"
          style={{ animationDelay: ".15s" }}
        >
          Coming
          <br />
          Soon
        </h1>

        {/* serverNow is read here, per request (the page is force-dynamic), so
            the countdown starts from the server's clock rather than the device's. */}
        <div className="launch-rise mt-6 sm:mt-7" style={{ animationDelay: ".25s" }}>
          <LaunchCountdown target={LAUNCH_AT} serverNow={Date.now()} />
        </div>

        <p className="launch-rise mt-6 text-xl sm:mt-7 font-semibold text-[#a2c36d] sm:text-2xl" style={{ animationDelay: ".3s" }}>
          Register &amp; Stay Tuned
        </p>
        <p
          className="launch-rise mt-3 max-w-md text-[15px] leading-relaxed text-white/65"
          style={{ animationDelay: ".35s" }}
        >
          Claim your player profile now. Find people to play with, follow them, and be first on court when we open.
        </p>

        <ul
          className="launch-rise mt-7 flex flex-wrap items-center justify-center gap-2 max-sm:order-1"
          style={{ animationDelay: ".4s" }}
        >
          {PERKS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/75 backdrop-blur-sm"
            >
              <Icon size={14} className="text-[#dee672]" /> {label}
            </li>
          ))}
        </ul>

        <div aria-hidden className="mt-8 flex h-9 items-end gap-3 max-sm:order-1">
          {[0, 0.15, 0.3, 0.45, 0.6].map((d, i) => (
            <span
              key={i}
              className="launch-ball block h-4 w-4 rounded-full bg-[#d9ec4f] shadow-[0_0_14px_rgba(217,236,79,0.6)] sm:h-5 sm:w-5"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </div>

        <div
          className="launch-rise mt-6 flex w-full sm:mt-8 flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: ".45s" }}
        >
          {session ? (
            <>
              <Link href="/dashboard" className="btn-volt w-full sm:w-auto">
                My profile <ArrowRight size={16} />
              </Link>
              <Link href="/players" className={OUTLINE_BTN}>
                <Users size={16} /> Discover players
              </Link>
            </>
          ) : (
            <>
              <Link href="/signup" className="btn-volt w-full sm:w-auto">
                Register now <ArrowRight size={16} />
              </Link>
              <Link href="/login" className={OUTLINE_BTN}>
                Sign in
              </Link>
            </>
          )}
        </div>

        {count >= 10 && (
          <p className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-[#dee672]/20 bg-[#dee672]/[0.06] px-4 py-2 text-[13px] text-white/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#dee672] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#dee672]" />
            </span>
            <span>
              <strong className="tabular-nums font-semibold text-white">{count}</strong> players already registered
            </span>
          </p>
        )}
        {!session && (
          <Link href="/players" className="mt-5 text-sm text-white/60 underline-offset-4 hover:text-white hover:underline">
            Browse the community
          </Link>
        )}
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-3 px-4 pb-8 font-mono text-[11px] text-white/45 sm:flex-row sm:justify-between sm:px-8">
        <p>
          © {new Date().getFullYear()} {SITE.legalName} · {SITE.city}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {/* Full page load on purpose: the intro is set up by scripts that only run on a real load. */}
          <a href="/?intro=1" className="inline-flex items-center gap-1.5 hover:text-white">
            <Play size={12} /> Watch the intro
          </a>
          <a
            href={waLink("Hi Sparvic! I'd like to know more about the launch.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <MessageCircle size={12} /> WhatsApp
          </a>
          <a
            href={SITE.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <Instagram size={12} /> Instagram
          </a>
        </div>
      </footer>
    </main>
  );
}

const PERKS = [
  { icon: UserPlus, label: "Claim your profile" },
  { icon: Search, label: "Discover players" },
  { icon: Heart, label: "Follow & rally" },
];

// [left %, top %, size px, delay s] — fixed so server and client agree.
const STARS: [number, number, number, number][] = [
  [8, 22, 3, 0], [16, 64, 2, 1.1], [24, 14, 2, 2.2], [31, 78, 3, 0.6], [42, 9, 2, 1.7],
  [57, 12, 3, 0.3], [66, 72, 2, 2.6], [74, 18, 2, 1.3], [83, 58, 3, 0.9], [91, 28, 2, 2],
  [12, 46, 2, 2.9], [88, 82, 2, 0.4], [50, 88, 2, 1.5], [37, 36, 2, 2.4], [70, 40, 2, 0.1],
];
