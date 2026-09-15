"use client";

import { useState } from "react";
import { Camera, Trash2, Wallet } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { Avatar } from "@/components/player-directory";
import { WalletTopUp } from "@/components/wallet-topup";
import { GENDERS, ageFrom } from "@/lib/profile";
import type { WalletTransaction } from "@/lib/wallet";

type Profile = {
  email: string;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  age?: number | null;
  gender: string | null;
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
  transactions = [],
  razorpayEnabled = false,
  razorpayKeyId = "",
  hideWallet = false,
}: {
  profile: Profile;
  transactions?: WalletTransaction[];
  razorpayEnabled?: boolean;
  razorpayKeyId?: string;
  hideWallet?: boolean;
}) {
  const initialAge =
    profile.age != null
      ? String(profile.age)
      : profile.date_of_birth
        ? String(ageFrom(profile.date_of_birth) ?? "")
        : "";

  const [form, setForm] = useState({
    full_name: profile.full_name,
    age: initialAge,
    gender: profile.gender ?? "",
    bio: profile.bio ?? "",
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

    if (!form.full_name.trim() || form.full_name.trim().length < 2) {
      setError("Please enter your full name (compulsory).");
      return;
    }
    const numAge = Number(form.age);
    if (!form.age || !Number.isFinite(numAge) || numAge < 5 || numAge > 120) {
      setError("Please enter a valid age between 5 and 120 (compulsory).");
      return;
    }
    if (!form.gender) {
      setError("Please select your sex (compulsory).");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/player/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          age: numAge,
          gender: form.gender,
          bio: form.bio,
          phone: form.phone,
          city: form.city,
          dupr: hasRating ? rating : null,
          dupr_id: form.dupr_id.trim() || null,
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
      <PhotoCard profile={profile} />

      {!hideWallet && (
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
                <Wallet size={13} className="text-volt-deep" /> SuperPro wallet
              </p>
              <p className="mt-1 font-display text-5xl text-volt-deep">{formatPaise(profile.wallet_balance_paise)}</p>
            </div>
          </div>

          <div className="mt-5">
            <WalletTopUp
              razorpayEnabled={razorpayEnabled}
              razorpayKeyId={razorpayKeyId}
              name={profile.full_name}
              email={profile.email}
              phone={profile.phone}
            />
          </div>
        </div>
      )}

      <form onSubmit={submit} className="card p-6">
        <h2 className="text-2xl">Your details</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-email">Email</label>
            <input id="p-email" className="field opacity-60" value={profile.email} disabled readOnly />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-name">
              Full name <span className="text-signal">* (Compulsory)</span>
            </label>
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
            <label className="label" htmlFor="p-age">
              Age <span className="text-signal">* (Compulsory)</span>
            </label>
            <input
              id="p-age"
              type="number"
              min="5"
              max="120"
              className="field"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="e.g. 25"
              required
            />
            <p className="mt-1 text-[11px] text-ink/45">Used for age-category tournament divisions.</p>
          </div>

          <div>
            <label className="label" htmlFor="p-gender">
              Sex <span className="text-signal">* (Compulsory)</span>
            </label>
            <select
              id="p-gender"
              className="field cursor-pointer"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              required
            >
              <option value="">Choose sex…</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink/45">Required for tournament brackets.</p>
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
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-bio">Short bio</label>
            <textarea
              id="p-bio"
              rows={3}
              className="field resize-none"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 280) })}
              placeholder="Lefty. Lives in the kitchen. Will rally at 6am."
            />
            <p className="mt-1.5 text-[11px] text-ink/45">
              Shown on your public player page. {280 - form.bio.length} characters left.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="p-duprid">DUPR ID</label>
            <input
              id="p-duprid"
              className="field font-mono uppercase tracking-wider"
              value={form.dupr_id}
              onChange={(e) => setForm({ ...form, dupr_id: e.target.value.toUpperCase() })}
              placeholder="K9X2LM"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <label className="label" htmlFor="p-dupr">
              DUPR rating / Level
            </label>
            <input
              id="p-dupr"
              className="field"
              inputMode="decimal"
              value={form.dupr}
              onChange={(e) => setForm({ ...form, dupr: e.target.value })}
              placeholder="3.75"
            />
            {hasRating && (
              <p className="mt-1 text-[11px] text-volt-deep font-semibold">
                Level: {rating < 3.0 ? "Beginner" : rating < 3.75 ? "Intermediate" : rating < 4.5 ? "Advanced" : "Pro"}
              </p>
            )}
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

      {!hideWallet && (
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
      )}
    </div>
  );
}

/**
 * Profile photo. Uploaded on selection rather than behind a save button — the
 * file is the whole intent, and a second click to confirm it helps nobody.
 */
function PhotoCard({ profile }: { profile: Profile }) {
  const [url, setUrl] = useState(profile.avatar_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/player/avatar", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not upload that photo.");
      setUrl(data.avatar_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/player/avatar", { method: "DELETE" }).catch(() => {});
    setUrl(null);
    setBusy(false);
  }

  return (
    <div className="card flex flex-wrap items-center gap-5 p-6">
      <Avatar name={profile.full_name} src={url} size="lg" />

      <div className="min-w-0 flex-1">
        <h2 className="text-2xl">Profile photo</h2>
        <p className="mt-1.5 text-sm text-ink/60">
          Shows next to your name on court rosters and your player page.
          {profile.handle && (
            <>
              {" "}
              Yours is{" "}
              <a href={`/players/${profile.handle}`} className="underline">
                /players/{profile.handle}
              </a>
              .
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="btn-volt btn-sm cursor-pointer">
            {busy ? <Spinner /> : <Camera size={14} />}
            {url ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
          </label>
          {url && (
            <button type="button" onClick={remove} disabled={busy} className="btn-outline btn-sm">
              <Trash2 size={14} /> Remove
            </button>
          )}
          <span className="font-mono text-[11px] text-ink/40">JPEG, PNG or WebP · up to 3 MB</span>
        </div>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
