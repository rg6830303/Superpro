"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Wallet, X } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { Alert, Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";

type Player = {
  id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  skill_level: string | null;
  dupr: number | null;
  role: string | null;
  wallet_balance_paise: number;
  games: number;
  last_seen: string | null;
  has_account: boolean;
};

type WalletTx = {
  id: string;
  delta_paise: number;
  balance_after_paise: number;
  kind: string;
  reason: string | null;
  created_by: string;
  created_at: string;
};

export default function AdminPlayersPage() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Player | null>(null);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/players${search ? `?q=${encodeURIComponent(search)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load players.");
      setPlayers(data.players ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load players.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const accounts = players.filter((p) => p.has_account);
  const walletTotal = accounts.reduce((sum, p) => sum + Number(p.wallet_balance_paise ?? 0), 0);

  return (
    <div>
      <AdminHeader
        title="Players"
        sub="Registered accounts and guest bookers. Wallet balances are editable in place."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Registered accounts" value={accounts.length} />
        <StatTile label="Guest bookers" value={players.length - accounts.length} />
        <StatTile label="Wallet float held" value={formatPaise(walletTotal)} tone="gold" hint="Total unspent credit" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="mb-5 flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bone/30" />
          <input
            className="field pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone"
            aria-label="Search players"
          />
        </div>
        <button type="submit" className="btn-outline">
          Search
        </button>
      </form>

      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size={22} />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Player</th>
                <th>Contact</th>
                <th>Level</th>
                <th>Games</th>
                <th>Wallet</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-bone/45">
                    No players yet.
                  </td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.id ?? `guest-${p.phone}`}>
                    <td className="font-semibold text-bone">
                      {p.full_name}
                      {p.role === "admin" && <span className="chip-gold ml-2 py-0 text-[9px]">Admin</span>}
                    </td>
                    <td>
                      <span className="block text-xs text-bone/70">{p.email ?? "—"}</span>
                      <span className="block text-xs text-bone/45">{p.phone ?? "—"}</span>
                    </td>
                    <td className="capitalize">{p.skill_level ?? "—"}</td>
                    <td>{p.games}</td>
                    <td className={Number(p.wallet_balance_paise) > 0 ? "font-semibold text-gold" : "text-bone/40"}>
                      {p.has_account ? formatPaise(p.wallet_balance_paise) : "—"}
                    </td>
                    <td>
                      <span className={p.has_account ? "chip-live" : "chip"}>
                        {p.has_account ? "Account" : "Guest"}
                      </span>
                    </td>
                    <td>
                      {p.has_account && (
                        <button type="button" onClick={() => setActive(p)} className="btn-outline btn-sm">
                          <Wallet size={13} /> Wallet
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {active?.id && (
        <WalletDrawer
          player={active}
          onClose={() => setActive(null)}
          onChanged={(balance) => {
            setPlayers((prev) =>
              prev.map((p) => (p.id === active.id ? { ...p, wallet_balance_paise: balance } : p)),
            );
            setActive((prev) => (prev ? { ...prev, wallet_balance_paise: balance } : prev));
          }}
        />
      )}
    </div>
  );
}

function WalletDrawer({
  player,
  onClose,
  onChanged,
}: {
  player: Player;
  onClose: () => void;
  onChanged: (balancePaise: number) => void;
}) {
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("topup");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/wallet?user_id=${player.id}`);
      const data = await res.json();
      if (res.ok) setTransactions(data.transactions ?? []);
    } finally {
      setLoading(false);
    }
  }, [player.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(sign: 1 | -1) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount in rupees.");
      return;
    }
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: player.id,
          amount_rupees: value * sign,
          kind: sign === 1 ? kind : "adjustment",
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update the wallet.");
      onChanged(data.balance_paise);
      setDone(`Wallet is now ${formatPaise(data.balance_paise)}.`);
      setAmount("");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the wallet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-ink-900 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Wallet</p>
            <h2 className="mt-1 text-3xl">{player.full_name}</h2>
            <p className="mt-1 text-xs text-bone/45">{player.email ?? player.phone}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-bone/60 hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="card mt-6 p-5">
          <p className="text-[11px] uppercase tracking-wider text-bone/40">Current balance</p>
          <p className="mt-1 font-display text-5xl text-gold">{formatPaise(player.wallet_balance_paise)}</p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="w-amount">Amount (₹)</label>
            <input
              id="w-amount"
              className="field"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
            />
          </div>
          <div>
            <label className="label" htmlFor="w-kind">Reason type</label>
            <select id="w-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="topup">Top-up</option>
              <option value="refund">Refund</option>
              <option value="bonus">Bonus / promo</option>
              <option value="adjustment">Correction</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="w-reason">Note (optional)</label>
            <input
              id="w-reason"
              className="field"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cash received at TurfXL"
            />
          </div>

          {error && <Alert>{error}</Alert>}
          {done && <Alert tone="ok">{done}</Alert>}

          <div className="flex gap-3">
            <button type="button" onClick={() => submit(1)} disabled={busy} className="btn-gold flex-1">
              {busy ? <Spinner /> : null} Credit
            </button>
            <button type="button" onClick={() => submit(-1)} disabled={busy} className="btn-danger flex-1">
              Debit
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xl">History</h3>
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner />
            </div>
          ) : transactions.length === 0 ? (
            <p className="mt-3 text-sm text-bone/40">No wallet movements yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="min-w-0">
                    <p className="text-sm capitalize text-bone">{t.kind}</p>
                    <p className="truncate text-xs text-bone/45">{t.reason ?? "—"}</p>
                    <p className="mt-0.5 text-[11px] text-bone/30">
                      {new Date(t.created_at).toLocaleString("en-IN")} · {t.created_by}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold ${t.delta_paise > 0 ? "text-ok" : "text-danger"}`}>
                      {t.delta_paise > 0 ? "+" : "−"}
                      {formatPaise(Math.abs(t.delta_paise))}
                    </p>
                    <p className="text-[11px] text-bone/35">{formatPaise(t.balance_after_paise)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
