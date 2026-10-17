"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, UserPlus, Users } from "lucide-react";
import { Spinner } from "@/components/ui";
import { Avatar } from "@/components/player-directory";
import { OPEN_CATEGORIES, type OpenCategory } from "@/lib/sparvic-open";

type Seeker = { id: string; name: string; handle: string | null; avatar_url: string | null; gender: string | null; dupr_doubles: number | null; phone: string | null };
type Boards = { mine: string[]; groups: Record<string, Seeker[]> };

const label = (id: string) => OPEN_CATEGORIES.find((c) => c.id === id)?.label ?? id;
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`;

/**
 * "Need a partner?" for doubles: pick the eligible categories you're looking
 * in, and everyone on the same board shows up so you can reach each other.
 */
export function PartnerBoard({ eligible }: { eligible: OpenCategory[] }) {
  const [boards, setBoards] = useState<Boards | null>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sparvic-open/seekers").then((r) => (r.ok ? r.json() : null)).then((d: Boards | null) => {
      if (d) { setBoards(d); setPicked(d.mine); }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/sparvic-open/seekers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categories: picked }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setBoards(data); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  };

  if (!eligible.length && !boards?.mine.length) return null;
  const mine = boards?.mine ?? [];

  return (
    <div className="so-seek">
      <button type="button" className="btn-outline btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <UserPlus size={14} /> {mine.length ? "Need a partner · edit" : "Need a partner?"}
      </button>

      {open && (
        <div className="so-seek-pick">
          <p className="text-xs text-ink/60">Pick the doubles categories you need a partner for. Others looking in the same category will see you, and you&apos;ll see them.</p>
          <div className="mt-2 grid gap-1.5">
            {eligible.map((c) => (
              <label key={c.id} className="so-seek-opt">
                <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-signal">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-volt btn-sm" disabled={busy} onClick={save}>{busy ? <Spinner /> : null} Save</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => { setOpen(false); setPicked(mine); }}>Cancel</button>
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <div className="mt-3 grid gap-3">
          {mine.map((cat) => {
            const others = boards?.groups[cat] ?? [];
            return (
              <div key={cat} className="so-seek-group">
                <p className="so-seek-title"><Users size={13} /> {label(cat)} · looking for a partner</p>
                <ul className="mt-2 space-y-2">
                  <li className="so-seek-me">You&apos;re on this board</li>
                  {others.length === 0 && <li className="text-xs text-ink/55">No one else yet. We&apos;ll show players here as they join.</li>}
                  {others.map((s) => (
                    <li key={s.id} className="flex items-center gap-3">
                      <Avatar name={s.name} src={s.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                        <p className="text-[11px] text-ink/55">Doubles DUPR {s.dupr_doubles?.toFixed(2) ?? "—"}{s.gender ? ` · ${s.gender}` : ""}</p>
                      </div>
                      {s.phone && <a href={waLink(s.phone)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-volt-deep hover:underline" aria-label={`WhatsApp ${s.name}`}><MessageCircle size={14} className="inline" /> Chat</a>}
                      {s.handle && <Link href={`/dashboard/players/${s.handle}`} className="text-xs font-semibold text-volt-deep hover:underline">Profile</Link>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
