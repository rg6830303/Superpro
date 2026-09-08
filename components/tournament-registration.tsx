"use client";

import { useState } from "react";
import { Banknote, Check, CreditCard, MessageCircle } from "lucide-react";
import { openRazorpay } from "@/components/razorpay-client";
import { Alert, Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { waLink } from "@/lib/site";
import type { Tournament } from "@/lib/types";

type Confirmation = { reference: string; team_name: string; status: string; payment_method: string };

export function TournamentRegistration({
  tournament,
  razorpayEnabled,
  razorpayKeyId,
}: {
  tournament: Tournament;
  razorpayEnabled: boolean;
  razorpayKeyId: string;
}) {
  const categories = Array.isArray(tournament.categories) ? tournament.categories : [];
  const [team, setTeam] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [p1, setP1] = useState({ name: "", phone: "", dupr: "" });
  const [p2, setP2] = useState({ name: "", phone: "", dupr: "" });
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<"razorpay" | "venue">(razorpayEnabled ? "razorpay" : "venue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const duprSum = (Number(p1.dupr) || 0) + (Number(p2.dupr) || 0);
  const overCap = tournament.dupr_cap != null && duprSum > Number(tournament.dupr_cap);
  const full = (tournament.teams ?? 0) >= tournament.max_teams;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tournaments/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tournament_id: tournament.id,
          team_name: team,
          category,
          player1_name: p1.name,
          player1_phone: p1.phone,
          player1_dupr: p1.dupr ? Number(p1.dupr) : null,
          player2_name: p2.name || undefined,
          player2_phone: p2.phone || undefined,
          player2_dupr: p2.dupr ? Number(p2.dupr) : null,
          email,
          payment_method: pay,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not register that team.");

      if (!data.razorpay_order_id) {
        setConfirmation(data);
        setBusy(false);
        return;
      }

      const opened = await openRazorpay({
        keyId: razorpayKeyId,
        orderId: data.razorpay_order_id,
        amountPaise: data.amount_paise,
        name: "SuperPro Tournaments",
        description: tournament.title,
        prefill: { name: p1.name, email, contact: p1.phone },
        notes: { reference: data.reference },
        onSuccess: async (payload) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "tournament", reference: data.reference, ...payload }),
          });
          if (verify.ok) setConfirmation({ ...data, payment_method: "razorpay", status: "confirmed" });
          else setError("Payment could not be verified. Message a rep with your reference.");
          setBusy(false);
        },
        onDismiss: () => setBusy(false),
      });

      if (!opened) {
        setError("Payment window could not open. Switch to pay-at-venue, or message a rep.");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (confirmation) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok text-ink">
          <Check size={28} />
        </div>
        <h3 className="mt-5 text-3xl">
          {confirmation.status === "waitlist" ? "You're on the waitlist" : "Team entered"}
        </h3>
        <p className="mt-3 text-sm text-bone/55">
          <span className="font-semibold text-bone">{confirmation.team_name}</span> · reference{" "}
          <span className="font-semibold text-gold">{confirmation.reference}</span>
        </p>
        <p className="mt-3 text-sm text-bone/45">
          Groups and match timings are published here and posted to the WhatsApp group once the draw closes.
        </p>
        <a
          href={waLink(`Hi SuperPro! Question about our ${tournament.title} entry (${confirmation.reference}).`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn bg-[#25D366] mt-6 text-ink hover:brightness-110"
        >
          <MessageCircle size={16} /> Message a rep
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-7">
      <h2 className="text-2xl">Register your team</h2>
      <p className="mt-1.5 text-sm text-bone/50">
        {full
          ? "The draw is full — new entries join the waitlist and get the first cancellation."
          : `${tournament.max_teams - (tournament.teams ?? 0)} of ${tournament.max_teams} spots left.`}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className={categories.length > 0 ? "" : "sm:col-span-2"}>
          <label className="label" htmlFor="t-team">Team name</label>
          <input id="t-team" className="field" value={team} onChange={(e) => setTeam(e.target.value)} required minLength={2} placeholder="Kitchen Bandits" />
        </div>
        {categories.length > 0 && (
          <div>
            <label className="label" htmlFor="t-cat">Category</label>
            <select id="t-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <fieldset className="mt-6">
        <legend className="label">Player 1</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <input className="field" value={p1.name} onChange={(e) => setP1({ ...p1, name: e.target.value })} required placeholder="Full name" aria-label="Player 1 name" />
          <input className="field" inputMode="numeric" value={p1.phone} onChange={(e) => setP1({ ...p1, phone: e.target.value })} required placeholder="WhatsApp number" aria-label="Player 1 phone" />
          <input className="field" inputMode="decimal" value={p1.dupr} onChange={(e) => setP1({ ...p1, dupr: e.target.value })} placeholder="DUPR (optional)" aria-label="Player 1 DUPR" />
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">Player 2 (partner)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <input className="field" value={p2.name} onChange={(e) => setP2({ ...p2, name: e.target.value })} placeholder="Full name" aria-label="Player 2 name" />
          <input className="field" inputMode="numeric" value={p2.phone} onChange={(e) => setP2({ ...p2, phone: e.target.value })} placeholder="WhatsApp number" aria-label="Player 2 phone" />
          <input className="field" inputMode="decimal" value={p2.dupr} onChange={(e) => setP2({ ...p2, dupr: e.target.value })} placeholder="DUPR (optional)" aria-label="Player 2 DUPR" />
        </div>
        <p className="mt-1.5 text-[11px] text-bone/35">
          No partner yet? Leave this blank — we&apos;ll pair you from the solo pool.
        </p>
      </fieldset>

      {tournament.dupr_cap != null && (
        <p className={`mt-4 rounded-xl px-4 py-3 text-xs ${overCap ? "bg-danger/10 text-danger" : "bg-white/5 text-bone/50"}`}>
          Team DUPR cap {Number(tournament.dupr_cap).toFixed(1)} · your combined rating {duprSum.toFixed(1)}
          {overCap ? " — over the cap, the organisers will confirm eligibility." : ""}
        </p>
      )}

      <div className="mt-5">
        <label className="label" htmlFor="t-email">Email (optional)</label>
        <input id="t-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {tournament.entry_fee_paise > 0 && (
        <div className="mt-6">
          <span className="label">Entry fee — {formatPaise(tournament.entry_fee_paise)} per team</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => razorpayEnabled && setPay("razorpay")}
              disabled={!razorpayEnabled}
              className={`tile ${pay === "razorpay" ? "tile-selected" : ""} ${!razorpayEnabled ? "opacity-40" : ""}`}
            >
              <CreditCard size={18} className="text-gold" />
              <p className="mt-2 font-display text-lg uppercase text-bone">Pay online</p>
              <p className="mt-1 text-xs text-bone/50">Entry confirms instantly.</p>
            </button>
            <button type="button" onClick={() => setPay("venue")} className={`tile ${pay === "venue" ? "tile-selected" : ""}`}>
              <Banknote size={18} className="text-gold" />
              <p className="mt-2 font-display text-lg uppercase text-bone">Pay on the day</p>
              <p className="mt-1 text-xs text-bone/50">Settle at the desk before your first match.</p>
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <label className="label" htmlFor="t-notes">Anything the organisers should know? (optional)</label>
        <textarea id="t-notes" rows={2} className="field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-gold mt-6 w-full">
        {busy ? <Spinner /> : null}
        {busy
          ? "Submitting…"
          : full
            ? "Join the waitlist"
            : tournament.entry_fee_paise > 0 && pay === "razorpay"
              ? `Pay ${formatPaise(tournament.entry_fee_paise)} & enter`
              : "Enter the draw"}
      </button>
    </form>
  );
}
