"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, TicketPercent, Trash2, Tag, Percent } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { AddButton, Drawer, ListState, submitResource } from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";
import { formatPaise } from "@/lib/money";

type Code = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "amount";
  percent_off: string | null;
  amount_off_paise: number | null;
  max_discount_paise: number | null;
  min_spend_paise: number;
  max_uses: number | null;
  used_count: number;
  per_user_limit: number | null;
  scopes: string[];
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  given_away_paise: number;
  last_used_at: string | null;
};

const TAB_OPTIONS = [
  { value: "all", label: "All (Shop, Games, Coaching, Tournaments)" },
  { value: "shop", label: "Shop (Equipment & Merchandise)" },
  { value: "games", label: "Daily Games (Court Bookings)" },
  { value: "coaching", label: "Coaching (Coach Bookings)" },
  { value: "tournaments", label: "Tournaments (Tournament Entries)" },
] as const;

/** An ISO timestamp as the local value a datetime-local input wants. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Plain English for the code's window, which is the thing admins misread most. */
function windowText(c: Code): string {
  const fmt = (v: string) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  if (!c.starts_at && !c.expires_at) return "No time limit";
  if (c.starts_at && c.expires_at) return `${fmt(c.starts_at)} → ${fmt(c.expires_at)}`;
  if (c.expires_at) return `Until ${fmt(c.expires_at)}`;
  return `From ${fmt(c.starts_at as string)}`;
}

function remaining(c: Code): string {
  if (c.max_uses == null) return "Unlimited";
  const left = Math.max(0, c.max_uses - c.used_count);
  return `${left} of ${c.max_uses} left`;
}

function valueText(c: Code): string {
  return c.kind === "percent"
    ? `${Number(c.percent_off)}% off`
    : `${formatPaise(Number(c.amount_off_paise ?? 0))} off`;
}

function formatScopeBadge(scopes: string[] = []): string {
  if (!scopes || scopes.length === 0 || scopes.length >= 4) return "All Tabs";
  if (scopes.length === 1) {
    if (scopes[0] === "shop") return "Shop";
    if (scopes[0] === "games") return "Games";
    if (scopes[0] === "coaching") return "Coaching";
    if (scopes[0] === "tournaments") return "Tournaments";
  }
  return scopes.join(", ");
}

export default function AdminDiscountsPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Code | null>(null);
  const [creating, setCreating] = useState(false);

  // Form states
  const [codeName, setCodeName] = useState("");
  const [kind, setKind] = useState<"amount" | "percent">("amount");
  const [flatRupees, setFlatRupees] = useState("");
  const [percentValue, setPercentValue] = useState("");
  const [targetTab, setTargetTab] = useState<string>("all");
  const [maxUses, setMaxUses] = useState("");
  const [timed, setTimed] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discounts");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load codes.");
      setCodes(body.codes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setCodeName("");
    setKind("amount");
    setFlatRupees("100");
    setPercentValue("10");
    setTargetTab("all");
    setMaxUses("50");
    setTimed(false);
    setStartsAt("");
    setExpiresAt("");
    setDescription("");
    setActive(true);
    setFormError(null);
    setConfirmDelete(false);
    setEditing(null);
    setCreating(true);
  }

  function startEdit(c: Code) {
    setCodeName(c.code);
    setKind(c.kind);
    setFlatRupees(c.amount_off_paise != null ? String(Math.round(c.amount_off_paise / 100)) : "");
    setPercentValue(c.percent_off != null ? String(Number(c.percent_off)) : "");

    const s = c.scopes ?? [];
    if (s.length >= 4 || s.length === 0) {
      setTargetTab("all");
    } else if (s.length === 1 && ["shop", "games", "coaching", "tournaments"].includes(s[0])) {
      setTargetTab(s[0]);
    } else {
      setTargetTab("all");
    }

    setMaxUses(c.max_uses != null ? String(c.max_uses) : "");
    setTimed(Boolean(c.starts_at || c.expires_at));
    setStartsAt(toLocalInput(c.starts_at));
    setExpiresAt(toLocalInput(c.expires_at));
    setDescription(c.description ?? "");
    setActive(c.active);
    setFormError(null);
    setConfirmDelete(false);
    setCreating(false);
    setEditing(c);
  }

  async function handleSave() {
    setFormError(null);

    const cleanCode = codeName.trim().toUpperCase();
    if (!editing && !cleanCode) {
      setFormError("Enter a discount code (e.g. SUPER100).");
      return;
    }

    if (kind === "amount") {
      const rupees = Number(flatRupees);
      if (!Number.isFinite(rupees) || rupees <= 0) {
        setFormError("Enter a valid flat discount amount in Rupees (greater than 0).");
        return;
      }
    } else {
      const pct = Number(percentValue);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        setFormError("Enter a valid discount percentage between 1 and 100.");
        return;
      }
    }

    if (timed && !startsAt && !expiresAt) {
      setFormError("Pick a start, an end, or switch the code back to no time limit.");
      return;
    }
    if (timed && startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
      setFormError("The end has to be after the start.");
      return;
    }

    const scopes =
      targetTab === "all"
        ? ["shop", "games", "coaching", "tournaments"]
        : [targetTab];

    const payload: Record<string, unknown> = {
      kind,
      scopes,
      description: description.trim() || null,
      active,
      max_uses: maxUses.trim() !== "" ? Number(maxUses) : null,
      // Sent on every save, including as nulls, so that turning a timed code
      // back into an open-ended one actually clears the window.
      starts_at: timed && startsAt ? new Date(startsAt).toISOString() : null,
      expires_at: timed && expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    if (kind === "amount") {
      payload.amount_off_paise = Math.round(Number(flatRupees) * 100);
      payload.percent_off = null;
    } else {
      payload.percent_off = Number(percentValue);
      payload.amount_off_paise = null;
    }

    setSaving(true);
    try {
      let err: string | null = null;
      if (editing) {
        err = await submitResource("/api/admin/discounts", "PATCH", { id: editing.id, ...payload });
      } else {
        payload.code = cleanCode;
        err = await submitResource("/api/admin/discounts", "POST", payload);
      }

      if (err) {
        setFormError(err);
      } else {
        setCreating(false);
        setEditing(null);
        await load();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save discount code.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const err = await submitResource(`/api/admin/discounts?id=${editing.id}`, "DELETE");
      if (err) {
        setFormError(err);
      } else {
        setEditing(null);
        await load();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to delete discount code.");
    } finally {
      setSaving(false);
    }
  }

  const live = codes.filter((c) => c.active).length;
  const redeemed = codes.reduce((sum, c) => sum + c.used_count, 0);
  const givenAway = codes.reduce((sum, c) => sum + Number(c.given_away_paise ?? 0), 0);

  return (
    <div>
      <AdminHeader
        title="Discount codes"
        sub="Any value, any number of uses. A code stops working the moment its uses run out."
        action={<AddButton label="New code" onClick={startCreate} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Live codes" value={live} tone={live > 0 ? "accent" : "default"} />
        <StatTile label="Times redeemed" value={redeemed} />
        <StatTile label="Given away" value={formatPaise(givenAway)} hint="Total taken off by codes" />
      </div>

      <ListState loading={loading} error={error} empty={codes.length === 0} emptyLabel="No codes yet." />

      {!loading && codes.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Code</th>
                <th>Value</th>
                <th>Uses</th>
                <th>Works on</th>
                <th>Window</th>
                <th>Given away</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const exhausted = c.max_uses != null && c.used_count >= c.max_uses;
                const expired = Boolean(c.expires_at && new Date(c.expires_at).getTime() < Date.now());
                const pending = Boolean(c.starts_at && new Date(c.starts_at).getTime() > Date.now());
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="block font-mono font-semibold text-ink">{c.code}</span>
                      {c.description && <span className="block text-xs text-ink/55">{c.description}</span>}
                    </td>
                    <td className="font-semibold text-volt-deep">
                      {valueText(c)}
                    </td>
                    <td>
                      <span className="block text-sm">{remaining(c)}</span>
                      {c.used_count > 0 && (
                        <span className="block text-[11px] text-ink/45">
                          {c.used_count} redeemed
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="chip text-[11px]">
                        {formatScopeBadge(c.scopes)}
                      </span>
                    </td>
                    <td className="text-xs text-ink/65">{windowText(c)}</td>
                    <td className="text-xs font-mono">{formatPaise(Number(c.given_away_paise ?? 0))}</td>
                    <td>
                      <span className={!c.active || exhausted || expired || pending ? "chip" : "chip-volt"}>
                        {!c.active ? "Off" : exhausted ? "Used up" : expired ? "Expired" : pending ? "Scheduled" : "Live"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="btn-outline btn-sm inline-flex items-center gap-1.5"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && codes.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink/55">
          <TicketPercent size={15} className="text-volt-deep" />
          Mint one and it works at checkout immediately.
        </p>
      )}

      {/* Simplified, Clean Modal for Discount Code Creation & Editing */}
      {(creating || editing) && (
        <Drawer
          title={editing ? `Edit Code: ${editing.code}` : "New Discount Code"}
          sub={
            editing
              ? `${editing.used_count} redemption${editing.used_count === 1 ? "" : "s"} so far.`
              : "Live at checkout as soon as you save."
          }
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              {editing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className={`btn-sm flex items-center gap-1.5 text-xs transition-all ${
                    confirmDelete
                      ? "bg-signal text-white hover:bg-signal/90"
                      : "btn-ghost text-signal hover:bg-signal/10"
                  }`}
                >
                  <Trash2 size={13} />
                  {confirmDelete ? "Confirm Delete?" : "Delete"}
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setEditing(null);
                  }}
                  disabled={saving}
                  className="btn-outline btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-volt btn-sm min-w-[110px]"
                >
                  {saving ? <Spinner /> : null}
                  {saving ? "Saving…" : editing ? "Save Code" : "Create Code"}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {formError && <Alert>{formError}</Alert>}

            {/* Code Name */}
            <div>
              <label className="label" htmlFor="disc-code">
                Discount Code <span className="text-signal">*</span>
              </label>
              <input
                id="disc-code"
                type="text"
                disabled={Boolean(editing)}
                value={codeName}
                onChange={(e) => setCodeName(e.target.value.toUpperCase())}
                className="field font-mono uppercase tracking-wider"
                required
              />
              <p className="mt-1 text-[11px] text-ink/45">
                {editing
                  ? "The code string cannot be renamed once created to preserve redemption history."
                  : "Letters and numbers. Customers enter this code at checkout."}
              </p>
            </div>

            {/* Discount type — a select, so there is exactly one way to say it */}
            <div>
              <label className="label" htmlFor="disc-kind">
                Discount Type <span className="text-signal">*</span>
              </label>
              <select
                id="disc-kind"
                className="field cursor-pointer"
                value={kind}
                onChange={(e) => setKind(e.target.value as "amount" | "percent")}
              >
                <option value="amount">Flat — a fixed ₹ amount off</option>
                <option value="percent">Percentage — a % off the total</option>
              </select>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink/45">
                {kind === "amount" ? <Tag size={12} /> : <Percent size={12} />}
                {kind === "amount" ? "Takes the same rupees off every order." : "Scales with the order value."}
              </p>
            </div>

            {/* Discount Value: Rupee input or Percentage input */}
            {kind === "amount" ? (
              <div>
                <label className="label" htmlFor="disc-flat">
                  Flat Discount Amount (₹) <span className="text-signal">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 font-bold text-sm">₹</span>
                  <input
                    id="disc-flat"
                    type="number"
                    min="1"
                    step="1"
                    className="field pl-8"
                    value={flatRupees}
                    onChange={(e) => setFlatRupees(e.target.value)}
                   
                    required
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink/45">Enter flat amount in Rupees (e.g. 100 for ₹100 off).</p>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="disc-percent">
                  Discount Percentage (%) <span className="text-signal">*</span>
                </label>
                <div className="relative">
                  <input
                    id="disc-percent"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    className="field pr-8"
                    value={percentValue}
                    onChange={(e) => setPercentValue(e.target.value)}
                   
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50 font-bold text-sm">%</span>
                </div>
                <p className="mt-1 text-[11px] text-ink/45">Enter percentage between 1% and 100%.</p>
              </div>
            )}

            {/* Where to apply: Fixed drop-down selection (no text enter for tabs) */}
            <div>
              <label className="label" htmlFor="disc-tab">
                Where to apply this code <span className="text-signal">*</span>
              </label>
              <select
                id="disc-tab"
                className="field cursor-pointer"
                value={targetTab}
                onChange={(e) => setTargetTab(e.target.value)}
              >
                {TAB_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ink/45">
                Choose the exact tab or service where this discount applies.
              </p>
            </div>

            {/* Time limit — off by default, because most codes run open-ended */}
            <div>
              <label className="label" htmlFor="disc-timed">
                Time limit
              </label>
              <select
                id="disc-timed"
                className="field cursor-pointer"
                value={timed ? "window" : "none"}
                onChange={(e) => setTimed(e.target.value === "window")}
              >
                <option value="none">No time limit — runs until switched off or used up</option>
                <option value="window">Set a window</option>
              </select>

              {timed && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="disc-start">
                      Starts
                    </label>
                    <input
                      id="disc-start"
                      type="datetime-local"
                      className="field"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-ink/45">Blank means live right away.</p>
                  </div>
                  <div>
                    <label className="label" htmlFor="disc-end">
                      Ends
                    </label>
                    <input
                      id="disc-end"
                      type="datetime-local"
                      className="field"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-ink/45">Blank means it never expires.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Total Uses Allowed */}
            <div>
              <label className="label" htmlFor="disc-uses">
                Total Uses Allowed
              </label>
              <input
                id="disc-uses"
                type="number"
                min="1"
                step="1"
                className="field"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Blank for unlimited"
              />
              <p className="mt-1 text-[11px] text-ink/45">
                Total redemption cap across all users. Leave blank for unlimited uses.
              </p>
            </div>

            {/* Optional Note / Description */}
            <div>
              <label className="label" htmlFor="disc-desc">
                Note / Description
              </label>
              <input
                id="disc-desc"
                type="text"
                className="field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Active Toggle */}
            <div className="pt-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#06263D]"
                />
                <span className="text-sm font-medium text-ink">
                  Active (code is live and can be redeemed at checkout)
                </span>
              </label>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
