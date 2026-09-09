"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Alert, Spinner } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid credentials.");

      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-5 bg-ink">
      <div className="w-full max-w-md card p-8 border border-line">
        <div className="flex justify-center mb-6">
          <Logo height={28} href="/admin" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Admin Console</h1>
          <p className="mt-1 text-xs text-ink/65">Sign in to manage SuperPro platform</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ishaanchetani"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-volt mt-6 w-full py-3">
            {busy ? <Spinner /> : null} {busy ? "Authenticating…" : "Sign In to Console"}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-line pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            Protected Admin Environment · SuperPro Sports
          </p>
        </div>
      </div>
    </div>
  );
}
