"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import type { SkillLevel } from "@/lib/types";

const SKILLS: Array<{ value: SkillLevel; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "pro", label: "DUPR rated" },
];

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
      <p className="mt-2 text-sm text-bone/50">Sign in to see your bookings, orders and coaching sessions.</p>

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

      <button type="submit" disabled={busy} className="btn-gold mt-6 w-full">
        {busy ? <Spinner /> : null} {busy ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-5 text-center text-sm text-bone/45">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-gold hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-bone/35">
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
    skill_level: "beginner" as SkillLevel,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
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
      <p className="mt-2 text-sm text-bone/50">One account for games, coaching, orders and tournaments.</p>

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
          <p className="mt-1.5 text-[11px] text-bone/35">At least 8 characters.</p>
        </div>
      </div>

      <div className="mt-5">
        <span className="label">Skill level</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SKILLS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setForm({ ...form, skill_level: s.value })}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                form.skill_level === s.value ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-bone/60 hover:border-white/25"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-gold mt-6 w-full">
        {busy ? <Spinner /> : null} {busy ? "Creating account…" : "Create account"}
      </button>

      <p className="mt-5 text-center text-sm text-bone/45">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
