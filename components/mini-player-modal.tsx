"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, MapPin, Sparkles, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/player-directory";
import { Spinner } from "@/components/ui";
import { ageFrom } from "@/lib/profile";
import { LEVEL_LABEL } from "@/lib/levels";
import type { RosterPlayer } from "@/lib/types";

export function MiniPlayerModal({
  player,
  onClose,
}: {
  player: RosterPlayer;
  onClose: () => void;
}) {
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const calculatedAge = player.age ?? ageFrom(player.date_of_birth);

  useEffect(() => {
    // Check initial follow status if user has a handle or id
    if (!player.handle && !player.user_id) return;
    let isMounted = true;
    const fetchFollowState = async () => {
      try {
        const q = player.handle || player.name;
        const res = await fetch(`/api/players?q=${encodeURIComponent(q)}&limit=1`);
        const data = await res.json();
        const found = (data.players ?? []).find(
          (p: any) => p.id === player.user_id || p.handle === player.handle,
        );
        if (found && isMounted) {
          setFollowing(Boolean(found.is_following));
          setFollowersCount(found.followers ?? 0);
        }
      } catch {
        // Fallback
      }
    };
    fetchFollowState();
    return () => {
      isMounted = false;
    };
  }, [player]);

  async function toggleFollow() {
    if (!player.handle && !player.user_id) return;
    const nextState = !following;
    setFollowing(nextState);
    if (followersCount != null) {
      setFollowersCount(Math.max(0, followersCount + (nextState ? 1 : -1)));
    }
    setBusy(true);

    try {
      const res = await fetch("/api/players/follow", {
        method: nextState ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: player.user_id, handle: player.handle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFollowing(!nextState);
      } else if (typeof data.followers === "number") {
        setFollowersCount(data.followers);
      }
    } catch {
      setFollowing(!nextState);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.name}'s Profile`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px] animate-fade-in"
      />

      <div className="animate-pop-in relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_24px_64px_rgba(6,38,61,0.4)]">
        {/* Volt top rail */}
        <div className="h-1.5 w-full bg-volt" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-ink/40 transition-colors hover:bg-mist hover:text-ink"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Avatar & Basic Info */}
          <div className="flex items-center gap-4">
            <Avatar name={player.name} src={player.avatar_url} size="lg" />
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-volt-deep font-bold">
                Sparvic Player
              </span>
              <h3 className="truncate font-display text-xl font-bold text-ink">{player.name}</h3>
              {player.handle ? (
                <p className="font-mono text-xs text-ink/50">@{player.handle}</p>
              ) : (
                <p className="text-xs text-ink/50">Community Member</p>
              )}
            </div>
          </div>

          {/* DUPR and Tier Badges */}
          <div className="mt-4 rounded-xl border border-line bg-mist/30 p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] text-ink/60">DUPR Rating: </span>
              <span className="font-mono font-bold text-sm text-ink">
                {player.dupr != null ? Number(player.dupr).toFixed(2) : "Unrated"}
              </span>
            </div>
            <span className="chip-volt py-0.5 text-[10px] capitalize font-semibold">
              {LEVEL_LABEL[player.level ?? ""] ?? player.level ?? "Player"}
            </span>
          </div>

          {/* Demographics */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink/65">
            {calculatedAge && <span>{calculatedAge} yrs</span>}
            {calculatedAge && player.gender && <span>·</span>}
            {player.gender && (
              <span className="capitalize">{player.gender}</span>
            )}
            {(calculatedAge || player.gender) && player.city && <span>·</span>}
            {player.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} className="text-ink/40" /> {player.city}
              </span>
            )}
          </div>

          {/* Bio */}
          {player.bio && (
            <p className="mt-3 text-xs leading-relaxed italic text-ink/75 border-l-2 border-volt pl-2.5">
              &ldquo;{player.bio}&rdquo;
            </p>
          )}

          {/* Follower stats */}
          {followersCount != null && (
            <p className="mt-3 font-mono text-[11px] text-ink/50">
              <strong className="text-ink">{followersCount}</strong> {followersCount === 1 ? "follower" : "followers"}
            </p>
          )}

          {/* Actions: Follow + View Public Page */}
          <div className="mt-5 pt-4 border-t border-line/60 flex items-center gap-2">
            {player.handle ? (
              <button
                type="button"
                onClick={toggleFollow}
                disabled={busy}
                className={`flex-1 btn-sm inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
                  following
                    ? "border border-line bg-mist/60 text-ink hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700"
                    : "btn-volt"
                }`}
              >
                {busy ? (
                  <Spinner />
                ) : following ? (
                  <>
                    <Check size={13} /> Following
                  </>
                ) : (
                  <>
                    <UserPlus size={13} /> Follow Player
                  </>
                )}
              </button>
            ) : (
              <span className="text-xs text-ink/50 flex-1">Booked via Sparvic</span>
            )}

            {player.handle && (
              <Link
                href={`/players/${player.handle}`}
                target="_blank"
                className="btn-outline btn-sm inline-flex items-center gap-1 text-xs px-3"
              >
                <span>Full Profile</span>
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
