"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Compass, ExternalLink, Search, Sparkles, UserCheck, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/player-directory";
import { Spinner } from "@/components/ui";
import { LEVEL_LABEL } from "@/lib/levels";
import type { DirectoryPlayer } from "@/app/api/players/route";

type ViewKey = "all" | "following" | "followers" | "mutual";

const VIEW_TABS: Array<{ key: ViewKey; label: string; blurb: string }> = [
  { key: "all", label: "Discover", blurb: "Everyone playing with SuperPro." },
  { key: "following", label: "Following", blurb: "Players whose games you follow." },
  { key: "followers", label: "Followers", blurb: "Players who follow you." },
  { key: "mutual", label: "Mutuals", blurb: "You follow each other — your regular hitting partners." },
];

export function DiscoverPlayers({ currentUserId }: { currentUserId: string }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [counts, setCounts] = useState({ following: 0, followers: 0 });
  // Two states, deliberately: `loading` is the first fill, `refreshing` is every
  // search after it. Wiping the grid back to a spinner on each keystroke loses
  // the reader's place and makes typing feel like it broke something.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followerCountMap, setFollowerCountMap] = useState<Record<string, number>>({});
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});

  const fetchPlayers = useCallback(async (searchQuery: string, which: ViewKey, first: boolean) => {
    if (first) setLoading(true);
    else setRefreshing(true);
    try {
      const q = encodeURIComponent(searchQuery.trim());
      const res = await fetch(`/api/players?q=${q}&limit=36&view=${which}`);
      const data = await res.json();
      const list: DirectoryPlayer[] = data.players ?? [];
      setPlayers(list);
      if (data.counts) setCounts(data.counts);

      const fMap: Record<string, boolean> = {};
      const cMap: Record<string, number> = {};
      for (const p of list) {
        fMap[p.id] = p.is_following;
        cMap[p.id] = p.followers;
      }
      setFollowingMap((prev) => ({ ...prev, ...fMap }));
      setFollowerCountMap((prev) => ({ ...prev, ...cMap }));
    } catch (err) {
      console.error("[discover] fetch players failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const firstFill = useRef(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlayers(query, view, firstFill.current);
      firstFill.current = false;
    }, 250);
    return () => clearTimeout(timer);
  }, [query, view, fetchPlayers]);

  async function toggleFollow(player: DirectoryPlayer) {
    const isCurrentlyFollowing = Boolean(followingMap[player.id]);
    const nextState = !isCurrentlyFollowing;

    // Optimistic UI update
    setFollowingMap((prev) => ({ ...prev, [player.id]: nextState }));
    setFollowerCountMap((prev) => ({
      ...prev,
      [player.id]: Math.max(0, (prev[player.id] ?? player.followers) + (nextState ? 1 : -1)),
    }));
    setBusyMap((prev) => ({ ...prev, [player.id]: true }));

    try {
      const res = await fetch("/api/players/follow", {
        method: nextState ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: player.id, handle: player.handle }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Revert on error
        setFollowingMap((prev) => ({ ...prev, [player.id]: isCurrentlyFollowing }));
        setFollowerCountMap((prev) => ({ ...prev, [player.id]: player.followers }));
      } else if (typeof data.followers === "number") {
        setFollowerCountMap((prev) => ({ ...prev, [player.id]: data.followers }));
      }
    } catch {
      // Revert on network exception
      setFollowingMap((prev) => ({ ...prev, [player.id]: isCurrentlyFollowing }));
      setFollowerCountMap((prev) => ({ ...prev, [player.id]: player.followers }));
    } finally {
      setBusyMap((prev) => ({ ...prev, [player.id]: false }));
    }
  }

  // No client-side filtering: the server owns both the view and excluding the
  // viewer, so the page size is honest and nobody is lost off the end of it.
  const filteredPlayers = players;

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass size={18} className="text-volt-deep" />
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Community Discovery</p>
            </div>
            <h2 className="mt-1 text-2xl font-bold text-ink">Discover &amp; Follow Picklers</h2>
            <p className="mt-1 text-sm text-ink/65">
              Connect with players in Kolkata. Follow friends and rivals to see when they book daily games or enter tournaments.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="mt-5 relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players by name, handle, city or level"
            className="field pl-10"
          />
        </div>

        {/* One tab per relationship, each a real query rather than a filter over
            whatever happened to load. Counts come from the server so they are
            right even when the person is on page one of forty. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {VIEW_TABS.map((tab) => {
            const count =
              tab.key === "following" ? counts.following : tab.key === "followers" ? counts.followers : null;
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                aria-pressed={active}
                title={tab.blurb}
                className={`chip cursor-pointer text-xs transition-colors ${
                  active ? "border-ink bg-ink text-paper" : "hover:border-ink/40"
                }`}
              >
                {tab.label}
                {count !== null && (
                  <span className={active ? "text-paper/70" : "text-ink/45"}>{count}</span>
                )}
              </button>
            );
          })}
          {refreshing && <span className="ml-1 self-center"><Spinner /></span>}
        </div>

        <p className="mt-2 text-[11px] text-ink/50">{VIEW_TABS.find((t) => t.key === view)?.blurb}</p>
      </div>

      {/* Players Grid */}
      {loading ? (
        <div className="card grid place-items-center py-16">
          <Spinner />
          <p className="mt-3 text-xs text-ink/50">Finding picklers across SuperPro…</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="card py-16 text-center">
          <Users size={32} className="mx-auto text-ink/30" />
          <p className="mt-3 text-base font-semibold text-ink">
            {query.trim()
              ? `Nobody matches “${query.trim()}”.`
              : view === "following"
                ? "You are not following anyone yet."
                : view === "followers"
                  ? "No one follows you yet."
                  : view === "mutual"
                    ? "No mutual follows yet."
                    : "No picklers found."}
          </p>
          <p className="mt-1 text-xs text-ink/55">
            {query.trim()
              ? "Try a different name, handle, city or level."
              : view === "all"
                ? "Players appear here as they join SuperPro."
                : "Open Discover and follow a few players — their games and draws then show up in your feed."}
          </p>
          {!query.trim() && view !== "all" && (
            <button type="button" onClick={() => setView("all")} className="btn-volt btn-sm mt-4">
              Browse players
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlayers.map((player) => {
            const isFollowing = Boolean(followingMap[player.id]);
            const followersCount = followerCountMap[player.id] ?? player.followers;
            const isBusy = Boolean(busyMap[player.id]);

            return (
              <div
                key={player.id}
                className="card flex flex-col justify-between p-5 transition-all hover:border-ink/40 hover:shadow-md"
              >
                {/* Profile Snapshot */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <Avatar name={player.full_name} src={player.avatar_url} size="md" />
                    <span className="chip-volt py-0.5 text-[10px] font-semibold capitalize">
                      {LEVEL_LABEL[player.skill_level] ?? player.skill_level}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="truncate font-display text-lg font-bold text-ink">{player.full_name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-mono text-xs text-ink/50">@{player.handle}</p>
                      {player.follows_me && (
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                            isFollowing ? "bg-volt/20 text-volt-deep" : "bg-mist text-ink/55"
                          }`}
                        >
                          {isFollowing ? "Mutual" : "Follows you"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges / Metrics */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {player.dupr != null && (
                      <span className="rounded bg-mist px-2 py-0.5 font-mono font-semibold text-volt-deep text-[11px]">
                        DUPR {Number(player.dupr).toFixed(2)}
                      </span>
                    )}
                    {player.city && (
                      <span className="text-[11px] text-ink/55">{player.city}</span>
                    )}
                  </div>

                  <p className="mt-2.5 font-mono text-[11px] text-ink/50">
                    <strong className="text-ink">{followersCount}</strong> {followersCount === 1 ? "follower" : "followers"}
                  </p>
                </div>

                {/* Actions: Follow / Following & View Profile */}
                <div className="mt-5 pt-4 border-t border-line/60 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFollow(player)}
                    disabled={isBusy}
                    className={`flex-1 btn-sm inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
                      isFollowing
                        ? "border border-line bg-mist/60 text-ink hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700"
                        : "btn-volt"
                    }`}
                  >
                    {isBusy ? (
                      <Spinner />
                    ) : isFollowing ? (
                      <>
                        <Check size={13} /> Following
                      </>
                    ) : player.follows_me ? (
                      <>
                        <UserPlus size={13} /> Follow back
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} /> Follow
                      </>
                    )}
                  </button>

                  <Link
                    href={`/players/${player.handle}`}
                    className="btn-outline btn-sm inline-flex items-center gap-1 text-xs px-2.5"
                    aria-label={`View ${player.full_name}'s player page`}
                    title="View player page"
                  >
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
