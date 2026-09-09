"use client";

import { useState } from "react";
import { MessageCircle, Wallet } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { waLink } from "@/lib/site";
import type { WalletTransaction } from "@/lib/wallet";

type Profile = {
  email: string;
  full_name: string;
  phone: string;
  skill_level: string;
  city: string;
  dupr: number | null;
  dupr_id: string | null;
  whatsapp_opt_in: boolean;
  wallet_balance_paise: number;
};

export function ProfileForm({
  profile,
  transactions,
}: {
  profile: Profile;
  transactions: WalletTransaction[];
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name,
    phone: profile.phone ?? "",
    city: profile.city ?? "Kolkata",
    dupr: profile.dupr != null ? String(profile.dupr) : "",
    dupr_id: profile.dupr_id ?? "",
    whatsapp_opt_in: profile.whatsapp_opt_in,
  });

  // The band is derived server-side from the rating; the player only ever
  // sees and edits the rating itself.
  const rating = Number(form.dupr);
  const hasRating = form.dupr.trim() !== "" && Number.isFinite(rating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const res = await fetch("/api/player/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          city: form.city,
          dupr: hasRating ? rating : null,
          dupr_id: form.dupr_id,
          whatsapp_opt_in: form.whatsapp_opt_in,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save your details.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
              <Wallet size={13} className="text-volt-deep" /> SuperPro wallet
            </p>
            <p className="mt-1 font-display text-5xl text-volt-deep">{formatPaise(profile.wallet_balance_paise)}</p>
          </div>
          <a
            href={waLink("Hi SuperPro! I'd like to top up my wallet.")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary btn-sm"
          >
            <MessageCircle size={14} /> Top up
          </a>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink/55">
          Wallet credit can be spent on court slots and gear at checkout. Top-ups are loaded by a SuperPro rep
          at the venue and appear here immediately.
        </p>
      </div>

      <form onSubmit={submit} className="card p-6">
        <h2 className="text-2xl">Your details</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-email">Email</label>
            <input id="p-email" className="field opacity-60" value={profile.email} disabled readOnly />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-name">Full name</label>
            <input
              id="p-name"
              className="field"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              minLength={2}
            />
          </div>
          <div>
            <label className="label" htmlFor="p-phone">WhatsApp number</label>
            <input
              id="p-phone"
              className="field"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="98xxxxxxxx"
            />
          </div>
          <div>
            <label className="label" htmlFor="p-city">City</label>
            <input
              id="p-city"
              className="field"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="p-duprid">DUPR ID</label>
            <input
              id="p-duprid"
              className="field"
              value={form.dupr_id}
              onChange={(e) => setForm({ ...form, dupr_id: e.target.value })}
              placeholder="K9X2LM"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <label className="label" htmlFor="p-dupr">DUPR rating</label>
            <input
              id="p-dupr"
              className="field"
              inputMode="decimal"
              value={form.dupr}
              onChange={(e) => setForm({ ...form, dupr: e.target.value })}
              placeholder="3.75"
            />
          </div>
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={form.whatsapp_opt_in}
            onChange={(e) => setForm({ ...form, whatsapp_opt_in: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#06263D]"
          />
          Send my booking confirmations and court numbers on WhatsApp.
        </label>

        {error && (
          <div className="mt-5">
            <Alert>{error}</Alert>
          </div>
        )}
        {saved && (
          <div className="mt-5">
            <Alert tone="ok">Saved.</Alert>
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-volt mt-6">
          {busy ? <Spinner /> : null} {busy ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="card p-6">
        <h2 className="text-2xl">Wallet history</h2>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-ink/55">Nothing yet. Ask a rep to load credit at the venue.</p>
        ) : (
          <div className="table-wrap mt-5">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Note</th>
                  <th>Amount</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="capitalize">{t.kind}</td>
                    <td className="text-ink/70">{t.reason ?? "—"}</td>
                    <td className={t.delta_paise > 0 ? "text-volt-deep" : "text-signal"}>
                      {t.delta_paise > 0 ? "+" : "−"}
                      {formatPaise(Math.abs(t.delta_paise))}
                    </td>
                    <td>{formatPaise(t.balance_after_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
