"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Alert, Spinner } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
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
      <div className="w-full max-w-md card p-8 border border-white/10">
        <div className="flex justify-center mb-6">
          <Logo height={28} href="/admin" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-bone">Admin Console</h1>
          <p className="mt-1 text-xs text-bone/50">Sign in to manage SuperPro platform</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="admin-email">Email Address</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@superpro.in"
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

          <button type="submit" disabled={busy} className="btn-gold mt-6 w-full py-3">
            {busy ? <Spinner /> : null} {busy ? "Authenticating…" : "Sign In to Console"}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-white/10 pt-4">
          <p className="text-[11px] text-bone/35 uppercase tracking-wider">
            Protected Admin Environment · SuperPro Sports
          </p>
        </div>
      </div>
    </div>
  );
}
