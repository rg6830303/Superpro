"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";

export type GameBooking = {
  id: string;
  session_date: string;
  start_time: string;
  end_time?: string | null;
  venue_name: string;
  court_number: number | null;
  status: string;
  payment_status: string;
  amount_paise: number;
  level?: string | null;
  mixed_doubles?: boolean | null;
  waitlist_position?: number | null;
  started?: boolean | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Booked", cls: "chip-volt" },
  pending_approval: { label: "Awaiting approval", cls: "chip-warn" },
  waitlist: { label: "Waitlist", cls: "chip-warn" },
  cancelled: { label: "Cancelled", cls: "chip" },
  declined: { label: "Declined", cls: "chip" },
};
const LEVEL: Record<string, string> = { all: "Open to all", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

/** A player's daily-games bookings: court, tags, status, and leaving a slot or its waitlist. */
export function GameBookings({ games }: { games: GameBooking[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function leave(g: GameBooking) {
    const what = g.status === "waitlist" ? "leave the waitlist for" : "cancel your place on";
    const refund = g.payment_status === "paid" && g.status !== "waitlist" ? ` ${formatPaise(g.amount_paise)} will go back to your wallet.` : "";
    if (!confirm(`Do you want to ${what} ${formatDate(g.session_date)} ${formatTime(g.start_time)} at ${g.venue_name}?${refund}`)) return;
    setBusy(g.id);
    setMsg(null);
    try {
      const res = await fetch("/api/games/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ registration_id: g.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not cancel.");
      setMsg({ ok: true, text: data.message ?? "Cancelled." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not cancel." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert>}
      <ul className="grid gap-3 md:grid-cols-2">
        {games.map((g) => {
          const st = STATUS[g.status] ?? { label: g.status, cls: "chip" };
          const active = ["confirmed", "pending_approval", "waitlist"].includes(g.status);
          const canLeave = active && !g.started;
          return (
            <li key={g.id} className={`card p-4 ${active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg text-ink">{formatDate(g.session_date)} · {formatTime(g.start_time)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink/70">
                    <MapPin size={13} /> {g.venue_name}
                    {g.court_number != null && <> · <strong className="font-semibold text-ink">Court {g.court_number}</strong></>}
                  </p>
                </div>
                <span className={`shrink-0 ${st.cls}`}>
                  {st.label}
                  {g.status === "waitlist" && g.waitlist_position ? ` #${g.waitlist_position}` : ""}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {g.level && <span className="chip py-0 text-[10px]">{LEVEL[g.level] ?? g.level}</span>}
                {g.mixed_doubles && <span className="chip py-0 text-[10px] border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900">Mixed doubles</span>}
                <span className="ml-auto text-xs text-ink/60">
                  {g.status === "waitlist" ? "Not charged" : g.payment_status === "paid" ? `Paid ${formatPaise(g.amount_paise)}` : g.payment_status === "refunded" ? "Refunded" : `${formatPaise(g.amount_paise)} · pay at venue`}
                </span>
              </div>
              {g.status === "waitlist" && <p className="mt-2 text-[11px] text-ink/55">You&apos;ll be moved up automatically and messaged if a spot opens.</p>}
              {canLeave && (
                <button type="button" onClick={() => leave(g)} disabled={busy === g.id} className="mt-3 text-xs font-semibold text-signal hover:underline disabled:opacity-50">
                  {busy === g.id ? <Spinner size={12} /> : null} {g.status === "waitlist" ? "Leave waitlist" : "Leave slot"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
