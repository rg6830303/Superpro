"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Search, UserPlus, Users } from "lucide-react";
import { Spinner } from "@/components/ui";
import { initials } from "@/lib/profile";
import { LEVEL_LABEL } from "@/lib/levels";

export type DirectoryPlayer = {
  id: string;
  handle: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  skill_level: string;
  dupr: number | null;
  followers: number;
  is_following: boolean;
  /** They follow the viewer. With is_following, this is a mutual. */
  follows_me?: boolean;
};

export type FollowCounts = { following: number; followers: number };

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const box =
    size === "lg"
      ? "h-24 w-24 text-2xl"
      : size === "sm"
        ? "h-9 w-9 text-[11px]"
        : size === "xs"
          ? "h-8 w-8 text-[10px]"
          : "h-12 w-12 text-sm";
  return (
    <span
      className={`${box} grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-mist font-mono font-semibold tracking-wide text-ink/60`}
    >
      {src ? (
        // Player photos live in Supabase Storage, outside the next/image loader.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/**
 * Follow toggle. Optimistic, because the round trip is a write nobody waits
 * for — but it puts itself back if the server says no, rather than leaving the
 * button claiming something that did not happen.
 */
export function FollowButton({
  handle,
  initialFollowing,
  initialFollowers,
  followsMe = false,
  signedIn,
  size = "sm",
  onChange,
}: {
  handle: string;
  initialFollowing: boolean;
  initialFollowers: number;
  followsMe?: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
  onChange?: (following: boolean, followers: number) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  // A parent re-fetch (new search, new tab) is the source of truth.
  useEffect(() => setFollowing(initialFollowing), [initialFollowing]);

  const cls = size === "md" ? "" : "btn-sm";

  if (!signedIn) {
    return (
      <Link href={`/login?next=/players/${handle}`} className={`btn-outline ${cls}`}>
        <UserPlus size={14} /> Follow
      </Link>
    );
  }

  async function toggle() {
    const next = !following;
    setFollowing(next);
    onChange?.(next, Math.max(0, initialFollowers + (next ? 1 : -1)));
    setBusy(true);
    try {
      const res = await fetch("/api/players/follow", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "failed");
      onChange?.(next, typeof data.followers === "number" ? data.followers : initialFollowers);
    } catch {
      setFollowing(!next);
      onChange?.(!next, initialFollowers);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={`${following ? "btn-outline" : "btn-volt"} ${cls} min-w-[7.5rem] justify-center`}
    >
      {busy ? <Spinner /> : following ? <Check size={14} /> : <UserPlus size={14} />}
      {following ? "Following" : followsMe ? "Follow back" : "Follow"}
    </button>
  );
}

type ViewKey = "all" | "following" | "followers" | "mutual";

const VIEWS: Array<{ key: ViewKey; label: string; empty: string }> = [
  { key: "all", label: "Discover", empty: "No players listed yet." },
  { key: "following", label: "Following", empty: "You are not following anyone yet." },
  { key: "followers", label: "Followers", empty: "Nobody follows you yet — book a game and they will." },
  { key: "mutual", label: "Mutuals", empty: "No mutual follows yet. Follow back the people who follow you." },
];

const LEVELS = ["", "beginner", "intermediate", "advanced"] as const;

/**
 * The one player directory — the public Community page and the account's
 * community tab both render this, so they cannot drift apart again.
 *
 * Every filter is served by the API rather than applied to whatever loaded:
 * filtering a page client-side silently loses anyone past the first 36.
 */
export function PlayerDirectory({
  initial,
  initialCounts = { following: 0, followers: 0 },
  signedIn,
}: {
  initial: DirectoryPlayer[];
  initialCounts?: FollowCounts;
  signedIn: boolean;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("");
  const [players, setPlayers] = useState(initial);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (term: string, which: ViewKey, lvl: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: term, view: which, limit: "36" });
      if (lvl) params.set("level", lvl);
      const res = await fetch(`/api/players?${params}`);
      const data = await res.json();
      setPlayers(data.players ?? []);
      if (data.counts) setCounts(data.counts);
    } finally {
      setLoading(false);
    }
  }, []);

  // A server render is the first answer; only refetch once the reader asks for
  // something different. With nothing server-rendered (the account tab), the
  // first fetch happens on mount.
  const untouched = useRef(true);
  useEffect(() => {
    if (untouched.current && q === "" && view === "all" && level === "" && initial.length > 0) return;
    untouched.current = false;
    const t = setTimeout(() => load(q.trim(), view, level), q ? 260 : 0);
    return () => clearTimeout(t);
  }, [q, view, level, load, initial.length]);

  function onFollowChange(id: string, following: boolean, followers: number) {
    // Decided from current state, outside the updaters: a state updater must be
    // pure, and nesting one setState inside another double-counts in dev.
    const before = players.find((p) => p.id === id);
    if (before && before.is_following !== following) {
      setCounts((c) => ({ ...c, following: Math.max(0, c.following + (following ? 1 : -1)) }));
    }
    setPlayers((list) => list.map((p) => (p.id === id ? { ...p, is_following: following, followers } : p)));
  }

  const empty = q
    ? `Nobody matches “${q}”${level ? ` at ${LEVEL_LABEL[level].toLowerCase()}` : ""}.`
    : VIEWS.find((v) => v.key === view)?.empty;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
          <input
            type="search"
            className="field pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, handle or city"
            aria-label="Search players"
          />
          {loading && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Spinner />
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by level">
          {LEVELS.map((l) => (
            <button
              key={l || "any"}
              type="button"
              onClick={() => setLevel(l)}
              aria-pressed={level === l}
              className={`chip cursor-pointer transition-colors ${
                level === l ? "border-ink bg-ink text-paper" : "hover:border-ink/40"
              }`}
            >
              {l ? LEVEL_LABEL[l] : "Every level"}
            </button>
          ))}
        </div>
      </div>

      {signedIn && (
        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Players">
          {VIEWS.map((v) => {
            const n = v.key === "following" ? counts.following : v.key === "followers" ? counts.followers : null;
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(v.key)}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  active ? "border-volt-deep text-ink" : "border-transparent text-ink/55 hover:text-ink"
                }`}
              >
                {v.label}
                {n !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                      active ? "bg-volt-soft text-volt-deep" : "bg-mist text-ink/50"
                    }`}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className={`mt-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
        {players.length === 0 && loading ? (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-[82px] animate-pulse rounded-xl border border-line bg-mist/50" />
            ))}
          </ul>
        ) : players.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-5 py-14 text-center">
            <Users size={28} className="mx-auto text-ink/25" />
            <p className="mt-3 text-sm font-semibold text-ink">{empty}</p>
            {view !== "all" && !q && (
              <button type="button" onClick={() => setView("all")} className="btn-volt btn-sm mt-4">
                Discover players
              </button>
            )}
          </div>
        ) : (
          // grid-cols-1 is minmax(0,1fr), not auto: without it a long name or
          // meta line widened the column and pushed Follow off a phone screen.
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {players.map((p) => (
              <li key={p.id} className="min-w-0">
                <PlayerRow player={p} signedIn={signedIn} onFollowChange={onFollowChange} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * One player, laid out as a row rather than a tall card: on a phone that is
 * three people per screen instead of one, and the follow button sits where the
 * thumb already is.
 */
function PlayerRow({
  player: p,
  signedIn,
  onFollowChange,
}: {
  player: DirectoryPlayer;
  signedIn: boolean;
  onFollowChange: (id: string, following: boolean, followers: number) => void;
}) {
  const mutual = p.follows_me && p.is_following;
  return (
    <article className="group relative flex h-full items-center gap-3.5 rounded-xl border border-line bg-paper p-4 transition-colors hover:border-ink/30">
      <Avatar name={p.full_name} src={p.avatar_url} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* The name is the link, stretched over the row, so the whole card is
              a target without nesting the follow button inside an anchor. */}
          <Link
            href={`/players/${p.handle}`}
            className="truncate font-semibold text-ink after:absolute after:inset-0 after:rounded-xl group-hover:underline"
          >
            {p.full_name}
          </Link>
          {p.follows_me && (
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                mutual ? "bg-volt-soft text-volt-deep" : "bg-mist text-ink/55"
              }`}
            >
              {mutual ? "Mutual" : "Follows you"}
            </span>
          )}
        </div>
        {/* Two short lines rather than one long one: next to the follow button
            a single line was truncating the follower count off the end. */}
        <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-wide text-ink/45">
          {LEVEL_LABEL[p.skill_level] ?? p.skill_level}
          {p.dupr != null && ` · DUPR ${Number(p.dupr).toFixed(2)}`}
        </p>
        <p className="truncate font-mono text-[11px] text-ink/40">
          {p.followers} follower{p.followers === 1 ? "" : "s"}
        </p>
      </div>
      <div className="relative z-10 shrink-0">
        <FollowButton
          handle={p.handle}
          initialFollowing={p.is_following}
          initialFollowers={p.followers}
          followsMe={p.follows_me}
          signedIn={signedIn}
          onChange={(following, followers) => onFollowChange(p.id, following, followers)}
        />
      </div>
    </article>
  );
}
