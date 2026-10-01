"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, MailCheck } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { waLink } from "@/lib/site";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotRegistered(false);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotRegistered(data.code === "not_registered");
        throw new Error(data.error ?? "Could not send the reset link.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-volt-soft text-volt-deep">
          <MailCheck size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/65">
          We&apos;ve sent a password reset link to <strong className="text-ink">{email.trim()}</strong>. It works once
          and expires in one hour. If it isn&apos;t in your inbox within a couple of minutes, check your spam or
          promotions folder.
        </p>
        <button type="button" onClick={() => setSent(false)} className="btn-outline mt-6 w-full">
          Use a different email
        </button>
        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-volt-deep hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-7">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Forgot your password?</h1>
      <p className="mt-2 text-sm text-ink/65">
        Enter the email you registered with. If it matches a Sparvic account, we&apos;ll email you a secure link to
        choose a new password.
      </p>
      <div className="mt-6">
        <label className="label" htmlFor="f-email">Email</label>
        <input
          id="f-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
          {notRegistered && (
            <Link href="/signup" className="btn-outline mt-3 w-full">
              Create an account
            </Link>
          )}
        </div>
      )}
      <button type="submit" disabled={busy} className="btn-volt mt-6 w-full">
        {busy ? <Spinner /> : null} {busy ? "Sending…" : "Send reset link"}
      </button>
      <Link
        href="/login"
        className="mt-5 flex items-center justify-center gap-1.5 text-sm font-semibold text-volt-deep hover:underline"
      >
        <ArrowLeft size={14} /> Back to sign in
      </Link>
      <p className="mt-4 text-center text-xs text-ink/45">
        No email arriving?{" "}
        <a
          href={waLink("Hi Sparvic! I can't reset my password — please help.")}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink"
        >
          Message us on WhatsApp
        </a>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token, invalid }: { token: string; invalid: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(invalid);

  if (invalid) {
    return (
      <div className="card p-7 text-center">
        <h1 className="text-2xl font-bold text-ink">Link not working</h1>
        <p className="mt-2 text-sm text-ink/65">{invalid}</p>
        <Link href="/forgot-password" className="btn-volt mt-6 w-full">
          Send a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-volt-soft text-volt-deep">
          <CheckCircle2 size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">Password updated</h1>
        <p className="mt-2 text-sm text-ink/65">Sign in with your new password.</p>
        <button type="button" onClick={() => router.push("/login")} className="btn-volt mt-6 w-full">
          Sign in
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not reset your password.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-7">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Choose a new password</h1>
      <p className="mt-2 text-sm text-ink/65">At least 8 characters. You&apos;ll use it to sign in from now on.</p>
      <div className="mt-6 space-y-4">
        <PasswordField
          id="r-pass"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
          hint="Minimum 8 characters."
        />
        <PasswordField
          id="r-confirm"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
          minLength={8}
          error={confirm.length > 0 && confirm !== password ? "The two passwords do not match." : null}
        />
      </div>
      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}
      <button type="submit" disabled={busy} className="btn-volt mt-6 w-full">
        {busy ? <Spinner /> : null} {busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
