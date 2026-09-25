"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { ListState, submitResource } from "@/components/admin/crud";
import { formatPaise } from "@/lib/money";

type Tab = "feed" | "players" | "coaches";

type Event = {
  at: string;
  kind: string;
  action: string;
  who: string | null;
  detail: string | null;
  tone: "info" | "warn";
  href: string | null;
  extra: string | null;
};

type Player = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  handle: string | null;
  role: string;
  joined_at: string;
  last_login_at: string | null;
  last_active_at: string | null;
  wallet_balance_paise: number;
  logins_30d: number;
  failed_30d: number;
  bookings: number;
  orders: number;
  coaching: number;
  followers: number;
};

type CoachRow = {
  coach_id: string;
  name: string;
  roster_email: string | null;
  active: boolean;
  account_id: string | null;
  login_email: string | null;
  joined_at: string | null;
  last_login_at: string | null;
  logins_30d: number;
  failed_30d: number;
  bookings: number;
  awaiting: number;
};

const KINDS = [
  { key: "all", label: "Everything" },
  { key: "account", label: "Sign-ins & sign-ups" },
  { key: "booking", label: "Game bookings" },
  { key: "order", label: "Orders" },
  { key: "coaching", label: "Coaching" },
  { key: "tournament", label: "Tournaments" },
  { key: "follow", label: "Follows" },
  { key: "wallet", label: "Wallet" },
  { key: "admin", label: "Admin actions" },
];

const KIND_DOT: Record<string, string> = {
  account: "bg-ink/40",
  booking: "bg-volt-deep",
  order: "bg-[#10527e]",
  coaching: "bg-amber",
  tournament: "bg-[#7c3aed]",
  follow: "bg-[#0ea5e9]",
  wallet: "bg-[#16a34a]",
  admin: "bg-ink",
};

/** "3 min ago", "yesterday", "12 Sept" — scannable at a glance. */
function ago(iso: string | null): string {
  if (!iso) return "never";
  const t = Date.parse(iso.replace(" ", "T"));
  if (Number.isNaN(t)) return iso;
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "yesterday";
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} days ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function stamp(iso: string): string {
  const t = Date.parse(iso.replace(" ", "T"));
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminActivityPage() {
  const [tab, setTab] = useState<Tab>("feed");
  return (
    <div>
      <AdminHeader title="Activity" sub="Who is signing in, what they are doing, and every change made in this console." />
      <div className="mb-6 flex gap-1 border-b border-line" role="tablist">
        {(
          [
            ["feed", "Live feed"],
            ["players", "Player accounts"],
            ["coaches", "Coach accounts"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === key ? "border-volt-deep text-ink" : "border-transparent text-ink/55 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "feed" && <Feed />}
      {tab === "players" && <Players />}
      {tab === "coaches" && <Coaches />}
    </div>
  );
}

function Feed() {
  const [kind, setKind] = useState("all");
  const [days, setDays] = useState(7);
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ kind, days: String(days), q });
      const res = await fetch(`/api/admin/activity?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load activity.");
      setEvents(data.events ?? []);
      setCounts(data.counts ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, [kind, days, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Keep it live without a manual refresh: every 30 seconds while open.
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile label="Sign-ups" value={counts.signups ?? 0} />
        <StatTile label="Active accounts" value={counts.active_accounts ?? 0} hint="Signed in at least once" />
        <StatTile
          label="Failed sign-ins"
          value={counts.failed_logins ?? 0}
          tone={(counts.failed_logins ?? 0) > 10 ? "accent" : "default"}
        />
        <StatTile label="Game bookings" value={counts.bookings ?? 0} />
        <StatTile label="Orders" value={counts.orders ?? 0} />
        <StatTile label="Admin actions" value={counts.admin_actions ?? 0} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              aria-pressed={kind === k.key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                kind === k.key ? "bg-ink text-paper" : "border border-line text-ink/65 hover:text-ink"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
            <input
              className="field h-9 w-56 py-1.5 pl-8 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, ref"
              aria-label="Search activity"
            />
          </div>
          <select className="field h-9 w-auto py-1.5 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={1}>Last 24 h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="button" onClick={load} className="btn-outline btn-sm" aria-label="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <ListState loading={loading && events.length === 0} error={error} empty={!loading && events.length === 0} emptyLabel="Nothing in this period." />

      {events.length > 0 && (
        <ol className="card divide-y divide-line">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-start gap-3 px-4 py-3 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[e.kind] ?? "bg-ink/30"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-ink">
                  <span className="font-semibold">{e.who ?? "Someone"}</span>{" "}
                  <span className={e.tone === "warn" ? "text-signal" : "text-ink/70"}>
                    {e.tone === "warn" && <AlertTriangle size={12} className="mr-1 inline -translate-y-px" />}
                    {e.action.toLowerCase()}
                  </span>
                </p>
                {e.detail && <p className="truncate text-xs text-ink/50">{e.detail}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-ink/55" title={stamp(e.at)}>{ago(e.at)}</p>
                {e.href && (
                  <Link href={e.href} className="text-[11px] font-semibold text-volt-deep hover:underline">
                    Open
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Players() {
  const [rows, setRows] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/accounts?type=players")
      .then((r) => r.json())
      .then((d) => (d.players ? setRows(d.players) : setError(d.error ?? "Could not load accounts.")))
      .catch(() => setError("Could not load accounts."))
      .finally(() => setLoading(false));
  }, []);

  const shown = rows.filter((r) =>
    !q ? true : `${r.full_name ?? ""} ${r.email} ${r.phone ?? ""} ${r.handle ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const activeWeek = rows.filter((r) => r.last_active_at && Date.now() - Date.parse(r.last_active_at.replace(" ", "T")) < 7 * 86400_000).length;
  const flagged = rows.filter((r) => r.failed_30d >= 5).length;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Accounts" value={rows.length} />
        <StatTile label="Active this week" value={activeWeek} tone="accent" />
        <StatTile label="Never signed in again" value={rows.filter((r) => !r.last_login_at).length} />
        <StatTile label="5+ failed sign-ins (30d)" value={flagged} tone={flagged ? "accent" : "default"} />
      </div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <input className="field h-9 max-w-xs py-1.5 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts" aria-label="Search accounts" />
        <Link href="/admin/players" className="btn-outline btn-sm">Edit accounts &amp; wallets</Link>
      </div>
      <ListState loading={loading} error={error} empty={!loading && shown.length === 0} emptyLabel="No accounts." />
      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Player</th><th>Joined</th><th>Last seen</th><th>Sign-ins (30d)</th><th>Bookings</th>
                <th>Orders</th><th>Coaching</th><th>Wallet</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="block font-semibold text-ink">{r.full_name ?? "—"}</span>
                    <span className="block text-[11px] text-ink/50">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span>
                    {r.role !== "player" && <span className="chip-volt mt-1 inline-block">{r.role}</span>}
                  </td>
                  <td className="text-xs text-ink/60">{ago(r.joined_at)}</td>
                  <td className="text-xs text-ink/60">{ago(r.last_active_at ?? r.last_login_at)}</td>
                  <td>
                    {r.logins_30d}
                    {r.failed_30d > 0 && (
                      <span className={`ml-1.5 text-[11px] ${r.failed_30d >= 5 ? "font-semibold text-signal" : "text-ink/45"}`}>
                        · {r.failed_30d} failed
                      </span>
                    )}
                  </td>
                  <td>{r.bookings}</td>
                  <td>{r.orders}</td>
                  <td>{r.coaching}</td>
                  <td className={Number(r.wallet_balance_paise) < 0 ? "text-signal" : ""}>{formatPaise(Number(r.wallet_balance_paise))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Coaches() {
  const [rows, setRows] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/accounts?type=coaches")
      .then((r) => r.json())
      .then((d) => (d.coaches ? setRows(d.coaches) : setError(d.error ?? "Could not load coaches.")))
      .catch(() => setError("Could not load coaches."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function revoke(coachId: string, clearEmail: boolean) {
    const err = await submitResource(`/api/admin/accounts?coach_id=${coachId}${clearEmail ? "&clear_email=1" : ""}`, "DELETE");
    if (err) setError(err);
    setConfirm(null);
    load();
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Coaches" value={rows.length} />
        <StatTile label="With a portal login" value={rows.filter((r) => r.account_id).length} tone="accent" />
        <StatTile label="Invited, not set up" value={rows.filter((r) => !r.account_id && r.roster_email).length} />
        <StatTile label="Requests awaiting" value={rows.reduce((n, r) => n + r.awaiting, 0)} />
      </div>
      <p className="mb-4 text-sm text-ink/60">
        To invite a coach, add their login email on their profile in{" "}
        <Link href="/admin/coaching" className="font-semibold text-volt-deep hover:underline">Coaching</Link>; they then set up
        a password at <span className="font-mono text-xs">/coach/signup</span>.
      </p>
      <ListState loading={loading} error={error} empty={!loading && rows.length === 0} emptyLabel="No coaches yet — add them in Coaching." />
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Coach</th><th>Portal</th><th>Last sign-in</th><th>Sign-ins (30d)</th><th>Bookings</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.coach_id}>
                  <td>
                    <span className="block font-semibold text-ink">{r.name}</span>
                    {!r.active && <span className="chip mt-1 inline-block">Not listed</span>}
                  </td>
                  <td className="text-xs">
                    {r.account_id ? (
                      <span className="text-volt-deep">Active · {r.login_email}</span>
                    ) : r.roster_email ? (
                      <span className="text-amber">Invited · {r.roster_email}</span>
                    ) : (
                      <span className="text-ink/45">No login</span>
                    )}
                  </td>
                  <td className="text-xs text-ink/60">{r.account_id ? ago(r.last_login_at) : "—"}</td>
                  <td>
                    {r.logins_30d}
                    {r.failed_30d > 0 && (
                      <span className={`ml-1.5 text-[11px] ${r.failed_30d >= 5 ? "font-semibold text-signal" : "text-ink/45"}`}>
                        · {r.failed_30d} failed
                      </span>
                    )}
                  </td>
                  <td>
                    {r.bookings}
                    {r.awaiting > 0 && <span className="ml-1.5 text-[11px] text-amber">· {r.awaiting} awaiting</span>}
                  </td>
                  <td className="text-right">
                    {r.account_id &&
                      (confirm === r.coach_id ? (
                        <span className="inline-flex flex-wrap justify-end gap-1.5">
                          <button type="button" onClick={() => revoke(r.coach_id, false)} className="btn-sm rounded-full bg-signal px-3 text-xs font-semibold text-white">
                            Revoke login
                          </button>
                          <button type="button" onClick={() => revoke(r.coach_id, true)} className="btn-sm rounded-full border border-signal px-3 text-xs font-semibold text-signal">
                            Revoke &amp; remove invite
                          </button>
                          <button type="button" onClick={() => setConfirm(null)} className="btn-outline btn-sm text-xs">Cancel</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirm(r.coach_id)} className="btn-outline btn-sm text-xs">
                          Revoke…
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
