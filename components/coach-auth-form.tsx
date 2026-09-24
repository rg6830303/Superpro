"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { PasswordField } from "@/components/password-field";
import { Alert, Spinner } from "@/components/ui";

/**
 * Sign-in and sign-up for coaches — one form, two modes, because the only
 * difference is a confirm-password field and which endpoint it posts to.
 */
export function CoachAuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (signup && password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/coach/auth/${signup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push("/coach");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-7">
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-volt-soft text-volt-deep">
        <GraduationCap size={20} />
      </span>
      <p className="eyebrow mt-5">Coach portal</p>
      <h1 className="mt-2 text-3xl">{signup ? "Set up your coach login" : "Coach sign in"}</h1>
      <p className="mt-2 text-sm text-ink/65">
        {signup
          ? "Use the email the club has on your coach profile. You choose the password."
          : "Your bookings calendar and the players who booked you."}
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="c-email">
            Email
          </label>
          <input
            id="c-email"
            type="email"
            autoComplete="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <PasswordField
          id="c-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={signup ? 8 : undefined}
          hint={signup ? "At least 8 characters." : undefined}
          required
        />
        {signup && (
          <PasswordField
            id="c-pass2"
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
          />
        )}
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-volt mt-6 w-full">
        {busy ? <Spinner /> : null}
        {busy ? (signup ? "Setting up…" : "Signing in…") : signup ? "Create coach login" : "Sign in"}
      </button>

      <p className="mt-5 text-center text-sm text-ink/55">
        {signup ? (
          <>
            Already set up?{" "}
            <Link href="/coach/login" className="font-semibold text-volt-deep hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            First time here?{" "}
            <Link href="/coach/signup" className="font-semibold text-volt-deep hover:underline">
              Set up your login
            </Link>
          </>
        )}
      </p>
      <p className="mt-3 text-center text-xs text-ink/45">
        Playing rather than coaching?{" "}
        <Link href="/login" className="underline hover:text-ink">
          Player sign in
        </Link>
      </p>
    </form>
  );
}
