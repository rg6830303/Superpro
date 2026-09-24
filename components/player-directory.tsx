"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, UserCheck } from "lucide-react";
import { Spinner } from "@/components/ui";
import { Reveal } from "@/components/motion";
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
};

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "h-24 w-24 text-2xl" : size === "sm" ? "h-9 w-9 text-[11px]" : "h-14 w-14 text-sm";
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

/** Follow toggle. Optimistic, because the round trip is a write nobody waits for. */
export function FollowButton({
  handle,
  initialFollowing,
  initialFollowers,
  signedIn,
  size = "sm",
}: {
  handle: string;
  initialFollowing: boolean;
  initialFollowers: number;
  signedIn: boolean;
  size?: "sm" | "md";
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <Link href={`/login?next=/players/${handle}`} className={size === "md" ? "btn-outline" : "btn-outline btn-sm"}>
        <UserPlus size={14} /> Follow
      </Link>
    );
  }

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    setBusy(true);
    try {
      const res = await fetch("/api/players/follow", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "failed");
      setFollowers(data.followers ?? followers);
    } catch {
      // Put the button back where it was rather than lie about the state.
      setFollowing(!next);
      setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`${following ? "btn-outline" : "btn-volt"} ${size === "md" ? "" : "btn-sm"}`}
    >
      {busy ? <Spinner /> : following ? <UserCheck size={14} /> : <UserPlus size={14} />}
      {following ? "Following" : "Follow"}
    </button>
  );
}

export function PlayerDirectory({ initial, signedIn }: { initial: DirectoryPlayer[]; signedIn: boolean }) {
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState(initial);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/players?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setPlayers(data.players ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Debounced so a fast typist makes one request, not eight.
    const t = setTimeout(() => {
      if (q.trim() === "") setPlayers(initial);
      else search(q.trim());
    }, 280);
    return () => clearTimeout(t);
  }, [q, initial, search]);

  return (
    <div>
      <div className="relative mb-8 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35" />
        <input
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

      {players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink/55">
          {q ? `Nobody matches “${q}” yet.` : "No players listed yet."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 8) * 40}>
              <article className="flex h-full items-start gap-4 rounded-xl border border-line bg-paper p-5 transition-shadow hover:shadow-[0_8px_30px_-16px_rgba(6,38,61,0.35)]">
                <Avatar name={p.full_name} src={p.avatar_url} />
                <div className="min-w-0 flex-1">
                  <Link href={`/players/${p.handle}`} className="block truncate font-semibold text-ink hover:underline">
                    {p.full_name}
                  </Link>
                  <p className="truncate font-mono text-[11px] uppercase tracking-wide text-ink/45">
                    {p.city ?? "Kolkata"} · {LEVEL_LABEL[p.skill_level] ?? p.skill_level}
                    {p.dupr != null && ` · DUPR ${Number(p.dupr).toFixed(2)}`}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <FollowButton
                      handle={p.handle}
                      initialFollowing={p.is_following}
                      initialFollowers={p.followers}
                      signedIn={signedIn}
                    />
                    <span className="font-mono text-[11px] text-ink/45">
                      {p.followers} follower{p.followers === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
