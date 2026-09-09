"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Spinner } from "@/components/ui";
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign you in.");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-7">
      <h1 className="text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-ink/65">Sign in to see your bookings, orders and coaching sessions.</p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="l-email">Email</label>
          <input id="l-email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="l-pass">Password</label>
          <input id="l-pass" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-volt mt-6 w-full">
        {busy ? <Spinner /> : null} {busy ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-5 text-center text-sm text-ink/55">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-volt-deep hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-ink/45">
        You don&apos;t need an account to book a game or shop — it just keeps everything in one place.
      </p>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    dupr_id: "",
    dupr: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The band is derived server-side from the rating and never surfaced here —
  // players enter a DUPR, they do not pick a category.
  const rating = Number(form.dupr);
  const hasRating = form.dupr.trim() !== "" && Number.isFinite(rating);
  const ratingOutOfRange = hasRating && (rating < 2 || rating > 8);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          dupr_id: form.dupr_id,
          dupr: hasRating ? rating : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create your account.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-7">
      <h1 className="text-3xl">Join SuperPro</h1>
      <p className="mt-2 text-sm text-ink/65">One account for games, coaching, orders and tournaments.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="s-name">Full name</label>
          <input id="s-name" className="field" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required minLength={2} />
        </div>
        <div>
          <label className="label" htmlFor="s-email">Email</label>
          <input id="s-email" type="email" autoComplete="email" className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="label" htmlFor="s-phone">WhatsApp number</label>
          <input id="s-phone" inputMode="numeric" className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="98xxxxxxxx" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="s-pass">Password</label>
          <input id="s-pass" type="password" autoComplete="new-password" className="field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          <p className="mt-1.5 text-[11px] text-ink/45">At least 8 characters.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="s-duprid">DUPR ID (optional)</label>
          <input
            id="s-duprid"
            className="field"
            value={form.dupr_id}
            onChange={(e) => setForm({ ...form, dupr_id: e.target.value })}
            placeholder="e.g. K9X2LM"
            autoCapitalize="characters"
          />
        </div>
        <div>
          <label className="label" htmlFor="s-dupr">DUPR rating (optional)</label>
          <input
            id="s-dupr"
            className="field"
            inputMode="decimal"
            value={form.dupr}
            onChange={(e) => setForm({ ...form, dupr: e.target.value })}
            placeholder="3.75"
          />
          {ratingOutOfRange && <p className="field-error">DUPR ratings run from 2.0 to 8.0.</p>}
        </div>
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-volt mt-6 w-full">
        {busy ? <Spinner /> : null} {busy ? "Creating account…" : "Create account"}
      </button>

      <p className="mt-5 text-center text-sm text-ink/55">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-volt-deep hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
