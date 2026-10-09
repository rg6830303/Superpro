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
  hours_to_start?: number | string | null;
};

/** Mirrors lib/slot-rules.ts (kept here so this client file stays free of server imports). */
const FEE = 7500;
const CUTOFF_HOURS = 4;

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Booked", cls: "chip-volt" },
  pending_approval: { label: "Awaiting approval", cls: "chip-warn" },
  waitlist: { label: "Waitlist", cls: "chip-warn" },
  cancelled: { label: "Cancelled", cls: "chip" },
  declined: { label: "Declined", cls: "chip" },
};
const LEVEL: Record<string, string> = { all: "Open to all", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

/** A player's daily-games bookings: court, tags, status, and cancelling a slot or leaving its waitlist. */
export function GameBookings({ games }: { games: GameBooking[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function disclaimer(g: GameBooking): string {
    const slot = `${formatDate(g.session_date)} ${formatTime(g.start_time)} at ${g.venue_name}`;
    if (g.status === "waitlist") return `Leave the waitlist for ${slot}?\n\nNo charge — nothing was paid.`;
    const paid = g.payment_status === "paid" ? g.amount_paise : 0;
    const money =
      paid >= FEE
        ? `${formatPaise(paid - FEE)} goes back to your wallet (${formatPaise(paid)} paid, less ${formatPaise(FEE)}).`
        : `${formatPaise(FEE - paid)} will be deducted from your wallet.`;
    const late =
      Number(g.hours_to_start) < CUTOFF_HOURS
        ? `\n\nThe slot starts in under ${CUTOFF_HOURS} hours, so this only goes through if someone on the waitlist can take your spot.`
        : "";
    return `Cancel your place on ${slot}?\n\nA ${formatPaise(FEE)} cancellation charge applies per slot. ${money}${late}`;
  }

  async function leave(g: GameBooking) {
    if (!confirm(disclaimer(g))) return;
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
          const waiting = g.status === "waitlist";
          const late = Number(g.hours_to_start) < CUTOFF_HOURS;
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
                  {waiting && g.waitlist_position ? ` #${g.waitlist_position}` : ""}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {g.level && <span className="chip py-0 text-[10px]">{LEVEL[g.level] ?? g.level}</span>}
                {g.mixed_doubles && <span className="chip border-fuchsia-300 bg-fuchsia-50 py-0 text-[10px] text-fuchsia-900">Mixed doubles</span>}
                <span className="ml-auto text-xs text-ink/60">
                  {waiting
                    ? `${formatPaise(g.amount_paise)} from wallet if you get a spot`
                    : g.payment_status === "paid"
                      ? `Paid ${formatPaise(g.amount_paise)}`
                      : g.payment_status === "refunded"
                        ? "Refunded"
                        : `${formatPaise(g.amount_paise)} · pay at venue`}
                </span>
              </div>
              {waiting && (
                <p className="mt-2 text-[11px] text-ink/55">
                  You&apos;ll be moved up automatically if a spot opens, and the slot price is taken from your wallet then — keep it topped up. Leaving the waitlist is free.
                </p>
              )}
              {canLeave && !waiting && (
                <p className="mt-2 text-[11px] text-ink/50">
                  Cancelling costs {formatPaise(FEE)} per slot.{" "}
                  {late
                    ? `It starts in under ${CUTOFF_HOURS} hours, so you can only cancel if the waitlist can take your spot.`
                    : `Not possible within ${CUTOFF_HOURS} hours of the start unless the waitlist can take your spot.`}
                </p>
              )}
              {canLeave && (
                <button type="button" onClick={() => leave(g)} disabled={busy === g.id} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-signal hover:underline disabled:opacity-50">
                  {busy === g.id ? <Spinner size={12} /> : null}
                  {waiting ? "Leave waitlist (free)" : `Cancel slot · ${formatPaise(FEE)} charge`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
