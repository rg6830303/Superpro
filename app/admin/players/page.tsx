"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Search, Wallet } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import {
  AddButton,
  Drawer,
  ListState,
  RecordEditor,
  submitResource,
  type FieldDef,
  type RecordValues,
} from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";
import { DUPR_BANDS, skillFromDupr } from "@/lib/dupr";
import { formatPaise } from "@/lib/money";

type User = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  skill_level: string;
  dupr: number | null;
  dupr_id: string | null;
  city: string | null;
  role: "player" | "staff" | "admin";
  wallet_balance_paise: number;
  whatsapp_opt_in: boolean;
  games: number;
  orders: number;
  created_at: string;
  last_login_at: string | null;
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

const ROLE_OPTIONS = [
  { value: "player", label: "Player" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin (console access)" },
];

const CREATE_FIELDS: FieldDef[] = [
  { name: "full_name", label: "Full name", required: true, full: true },
  { name: "email", label: "Email", required: true, placeholder: "player@example.com" },
  { name: "phone", label: "WhatsApp number", placeholder: "98xxxxxxxx" },
  { name: "password", label: "Password", required: true, hint: "At least 8 characters. Share it with the player." },
  { name: "city", label: "City" },
  { name: "dupr_id", label: "DUPR ID", placeholder: "K9X2LM" },
  { name: "dupr", label: "DUPR rating", type: "number", hint: "Sets the category automatically." },
  { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS },
  { name: "wallet_rupees", label: "Opening wallet (₹)", type: "number", hint: "Optional. Recorded in the wallet ledger." },
];

const EDIT_FIELDS: FieldDef[] = [
  { name: "full_name", label: "Full name", required: true, full: true },
  { name: "email", label: "Email", full: true, hint: "Changing this also changes their sign-in email." },
  { name: "phone", label: "WhatsApp number" },
  { name: "city", label: "City" },
  { name: "dupr_id", label: "DUPR ID" },
  { name: "dupr", label: "DUPR rating", type: "number", hint: "Category follows the rating." },
  { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS },
  { name: "password", label: "New password", full: true, hint: "Leave blank to keep the current password." },
  { name: "whatsapp_opt_in", label: "Send WhatsApp confirmations", type: "checkbox" },
];

export default function AdminPlayersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [walletFor, setWalletFor] = useState<User | null>(null);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load accounts.");
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const walletTotal = users.reduce((sum, u) => sum + Number(u.wallet_balance_paise ?? 0), 0);
  const admins = users.filter((u) => u.role === "admin" || u.role === "staff").length;

  return (
    <div>
      <AdminHeader
        title="Player accounts"
        sub="Create, edit and remove accounts, and manage wallet balances."
        action={<AddButton label="New account" onClick={() => setCreating(true)} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Accounts" value={users.length} />
        <StatTile label="Staff & admins" value={admins} />
        <StatTile label="Wallet float held" value={formatPaise(walletTotal)} tone="accent" hint="Total unspent credit" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="mb-5 flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45" />
          <input
            className="field pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone"
            aria-label="Search accounts"
          />
        </div>
        <button type="submit" className="btn-outline">
          Search
        </button>
      </form>

      <ListState loading={loading} error={error} empty={users.length === 0} emptyLabel="No accounts yet." />

      {!loading && !error && users.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Player</th>
                <th>Contact</th>
                <th>DUPR</th>
                <th>Category</th>
                <th>Games</th>
                <th>Wallet</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold text-ink">{u.full_name}</td>
                  <td>
                    <span className="block text-xs text-ink/75">{u.email}</span>
                    <span className="block text-xs text-ink/55">{u.phone ?? "—"}</span>
                  </td>
                  <td>
                    {u.dupr != null ? (
                      <>
                        <span className="block text-ink">{Number(u.dupr).toFixed(2)}</span>
                        <span className="block text-[11px] text-ink/55">{u.dupr_id ?? "no ID"}</span>
                      </>
                    ) : (
                      <span className="text-ink/45">Unrated</span>
                    )}
                  </td>
                  <td className="capitalize">{u.skill_level}</td>
                  <td>{u.games}</td>
                  <td className={Number(u.wallet_balance_paise) > 0 ? "font-semibold text-volt-deep" : "text-ink/55"}>
                    {formatPaise(u.wallet_balance_paise)}
                  </td>
                  <td>
                    <span className={u.role === "player" ? "chip" : "chip-volt"}>{u.role}</span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(u)} className="btn-outline btn-sm">
                        <Pencil size={13} /> Edit
                      </button>
                      <button type="button" onClick={() => setWalletFor(u)} className="btn-outline btn-sm">
                        <Wallet size={13} /> Wallet
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <RecordEditor
          title="New account"
          sub="Creates the sign-in in Supabase and the player profile together."
          fields={CREATE_FIELDS}
          initial={{ role: "player", city: "Kolkata" }}
          submitLabel="Create account"
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const err = await submitResource("/api/admin/users", "POST", cleanUser(values));
            if (!err) await load(q);
            return err;
          }}
        />
      )}

      {editing && (
        <RecordEditor
          title={editing.full_name}
          sub={`Joined ${new Date(editing.created_at).toLocaleDateString("en-IN")} · ${editing.orders} orders`}
          fields={EDIT_FIELDS}
          initial={{
            full_name: editing.full_name,
            email: editing.email,
            phone: editing.phone ?? "",
            city: editing.city ?? "",
            dupr_id: editing.dupr_id ?? "",
            dupr: editing.dupr != null ? Number(editing.dupr) : null,
            role: editing.role,
            password: "",
            whatsapp_opt_in: editing.whatsapp_opt_in,
          }}
          submitLabel="Save changes"
          deleteLabel="Delete account"
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const err = await submitResource("/api/admin/users", "PATCH", {
              id: editing.id,
              ...cleanUser(values),
            });
            if (!err) await load(q);
            return err;
          }}
          onDelete={async () => {
            const err = await submitResource(`/api/admin/users?id=${editing.id}`, "DELETE");
            if (!err) await load(q);
            return err;
          }}
        />
      )}

      {walletFor && (
        <WalletDrawer
          user={walletFor}
          onClose={() => setWalletFor(null)}
          onChanged={(balance) => {
            setUsers((prev) => prev.map((u) => (u.id === walletFor.id ? { ...u, wallet_balance_paise: balance } : u)));
            setWalletFor((prev) => (prev ? { ...prev, wallet_balance_paise: balance } : prev));
          }}
        />
      )}
    </div>
  );
}

/** Drop blanks so a cleared optional field is not sent as an empty string. */
function cleanUser(values: RecordValues): RecordValues {
  const out: RecordValues = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function WalletDrawer({
  user,
  onClose,
  onChanged,
}: {
  user: User;
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
      const res = await fetch(`/api/admin/wallet?user_id=${user.id}`);
      const data = await res.json();
      if (res.ok) setTransactions(data.transactions ?? []);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

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
          user_id: user.id,
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
    <Drawer title="Wallet" sub={`${user.full_name} · ${user.email}`} onClose={onClose}>
      <div className="card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">Current balance</p>
        <p className="mt-1 font-display text-5xl text-volt-deep">{formatPaise(user.wallet_balance_paise)}</p>
        <p className="mt-2 text-xs text-ink/55">
          {DUPR_BANDS.find((b) => b.level === skillFromDupr(user.dupr))?.label} ·{" "}
          {user.dupr != null ? `DUPR ${Number(user.dupr).toFixed(2)}` : "unrated"}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="w-amount">Amount (₹)</label>
          <input id="w-amount" className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
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
          <input id="w-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cash received at TurfXL" />
        </div>

        {error && <Alert>{error}</Alert>}
        {done && <Alert tone="ok">{done}</Alert>}

        <div className="flex gap-3">
          <button type="button" onClick={() => submit(1)} disabled={busy} className="btn-volt flex-1">
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
          <p className="mt-3 text-sm text-ink/55">No wallet movements yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 border-b border-line/60 pb-3">
                <div className="min-w-0">
                  <p className="text-sm capitalize text-ink">{t.kind}</p>
                  <p className="truncate text-xs text-ink/55">{t.reason ?? "—"}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink/45">
                    <KeyRound size={9} /> {new Date(t.created_at).toLocaleString("en-IN")} · {t.created_by}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-semibold ${t.delta_paise > 0 ? "text-volt-deep" : "text-signal"}`}>
                    {t.delta_paise > 0 ? "+" : "−"}
                    {formatPaise(Math.abs(t.delta_paise))}
                  </p>
                  <p className="text-[11px] text-ink/45">{formatPaise(t.balance_after_paise)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
