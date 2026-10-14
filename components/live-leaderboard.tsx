"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Avatar } from "@/components/player-directory";
import { LEVEL_LABEL } from "@/lib/levels";
import type { RankRow } from "@/lib/dashboard-tabs";

const POLL_MS = 20_000;

/**
 * Club standings that keep themselves current: re-fetched every 20 s (and when
 * the tab regains focus). Rows glide to their new place and show how far they
 * moved, so a rating change or a finished game visibly reorders the table.
 */
export function LiveLeaderboard({
  initialRows = [],
  meId,
  limit = 500,
  variant = "full",
}: {
  initialRows?: RankRow[];
  meId: string | null;
  limit?: number;
  variant?: "full" | "mini";
}) {
  const [rows, setRows] = useState<RankRow[]>(initialRows.slice(0, limit));
  const [me, setMe] = useState<RankRow | null>(initialRows.find((r) => r.id === meId) ?? null);
  const [total, setTotal] = useState(initialRows.length);
  const [moves, setMoves] = useState<Record<string, number>>({});
  const [updated, setUpdated] = useState<number | null>(initialRows.length ? Date.now() : null);
  const [, tick] = useState(0);
  const els = useRef(new Map<string, HTMLElement>());
  const before = useRef(new Map<string, DOMRect>());
  const prevRank = useRef(new Map(initialRows.map((r) => [r.id, r.rank])));

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/players/leaderboard?limit=${limit}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { rows: RankRow[]; me: RankRow | null; total: number };
      // Remember where every row is now, so the next paint can slide from here.
      before.current = new Map([...els.current].map(([id, el]) => [id, el.getBoundingClientRect()]));
      const moved: Record<string, number> = {};
      for (const r of [...data.rows, ...(data.me ? [data.me] : [])]) {
        const was = prevRank.current.get(r.id);
        if (was && was !== r.rank) moved[r.id] = was - r.rank;
        prevRank.current.set(r.id, r.rank);
      }
      setRows(data.rows);
      setMe(data.me);
      setTotal(data.total);
      setUpdated(Date.now());
      if (Object.keys(moved).length) {
        setMoves(moved);
        setTimeout(() => setMoves({}), 8000);
      }
    } catch {
      /* offline: keep what we have */
    }
  }, [limit]);

  useEffect(() => {
    if (!initialRows.length) load();
    const t = setInterval(load, POLL_MS);
    const ago = setInterval(() => tick((n) => n + 1), 5000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      clearInterval(ago);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, initialRows.length]);

  // FLIP: slide each row from its old position to its new one.
  useLayoutEffect(() => {
    if (!before.current.size || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const [id, el] of els.current) {
      const from = before.current.get(id);
      if (!from) continue;
      const dy = from.top - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    before.current = new Map();
  }, [rows]);

  const secs = updated ? Math.max(0, Math.round((Date.now() - updated) / 1000)) : null;
  const showMe = variant === "full" && me && !rows.some((r) => r.id === me.id);

  const row = (r: RankRow) => {
    const move = moves[r.id];
    const body = (
      <>
        <span className="demo-rank-pos">{r.rank}</span>
        <Avatar name={r.full_name} src={r.avatar_url} size={variant === "mini" ? "xs" : "sm"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {variant === "mini" ? r.full_name.split(" ")[0] : r.full_name}
            {r.id === meId ? " (you)" : ""}
          </span>
          {variant === "full" && (
            <span className="block text-[11px] capitalize text-ink/55">
              {LEVEL_LABEL[r.skill_level] ?? r.skill_level} · {r.games} games
            </span>
          )}
        </span>
        {move ? (
          <span className={`demo-rank-move ${move > 0 ? "is-up" : "is-down"}`}>
            {move > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {Math.abs(move)}
          </span>
        ) : null}
        <span className="font-mono text-sm font-bold text-ink">{r.dupr != null ? Number(r.dupr).toFixed(2) : "—"}</span>
      </>
    );
    return (
      <li
        key={r.id}
        ref={(el) => {
          if (el) els.current.set(r.id, el);
          else els.current.delete(r.id);
        }}
        className={`${r.id === meId ? "is-me" : ""} ${move ? (move > 0 ? "moved-up" : "moved-down") : ""}`}
      >
        {r.handle && r.id !== meId ? <Link href={`/players/${r.handle}`}>{body}</Link> : <div>{body}</div>}
      </li>
    );
  };

  return (
    <div className={`demo-live-board demo-live-${variant}`}>
      <p className="demo-live-status">
        <span className="demo-live-pulse" aria-hidden="true" /> Live
        {secs !== null && <span>· updated {secs < 10 ? "just now" : `${secs}s ago`}</span>}
        {variant === "full" && total > 0 && <span>· {total} players</span>}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink/55">Standings appear once players join.</p>
      ) : (
        <ol className="demo-rank-list">
          {rows.map(row)}
          {showMe && (
            <>
              <li className="demo-rank-gap" aria-hidden="true">⋯</li>
              {row(me!)}
            </>
          )}
        </ol>
      )}
    </div>
  );
}
