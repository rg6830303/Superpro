"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, TicketPercent } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { AddButton, ListState, RecordEditor, submitResource, type FieldDef } from "@/components/admin/crud";
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

const SCOPES = [
  { value: "shop", label: "Shop" },
  { value: "games", label: "Daily games" },
  { value: "coaching", label: "Coaching" },
  { value: "tournaments", label: "Tournaments" },
];

const FIELDS: FieldDef[] = [
  { name: "code", label: "Code", required: true, hint: "Letters, numbers, dashes. Shown uppercase." },
  {
    name: "kind",
    label: "Type",
    type: "select",
    options: [
      { value: "percent", label: "Percentage off" },
      { value: "amount", label: "Fixed amount off" },
    ],
  },
  { name: "percent_off", label: "Percent off", type: "number", hint: "1-100. Used when type is percentage." },
  { name: "amount_off_paise", label: "Amount off (paise)", type: "number", hint: "50000 = ₹500. Used when type is fixed." },
  { name: "max_discount_paise", label: "Cap the discount at (paise)", type: "number", hint: "Optional ceiling for percentage codes." },
  { name: "min_spend_paise", label: "Minimum spend (paise)", type: "number", hint: "0 for no minimum." },
  { name: "max_uses", label: "Total uses allowed", type: "number", hint: "Blank for unlimited. The code stops working once these are gone." },
  { name: "per_user_limit", label: "Uses per person", type: "number", hint: "Blank for unlimited." },
  { name: "scopes", label: "Works on", type: "list", placeholder: "shop\ngames\ncoaching\ntournaments" },
  { name: "starts_at", label: "Starts", type: "date" },
  { name: "expires_at", label: "Expires", type: "date" },
  { name: "description", label: "Note", full: true, placeholder: "Diwali launch offer" },
  { name: "active", label: "Live", type: "checkbox" },
];

/** How many uses are left, phrased the way the person minting the code thinks. */
function remaining(c: Code): string {
  if (c.max_uses == null) return "unlimited";
  return `${Math.max(0, c.max_uses - c.used_count)} of ${c.max_uses} left`;
}

function value(c: Code): string {
  return c.kind === "percent"
    ? `${Number(c.percent_off)}% off`
    : `${formatPaise(Number(c.amount_off_paise ?? 0))} off`;
}

export default function AdminDiscountsPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Code | null>(null);
  const [creating, setCreating] = useState(false);

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

  const live = codes.filter((c) => c.active).length;
  const redeemed = codes.reduce((sum, c) => sum + c.used_count, 0);
  const givenAway = codes.reduce((sum, c) => sum + Number(c.given_away_paise ?? 0), 0);

  return (
    <div>
      <AdminHeader
        title="Discount codes"
        sub="Any value, any number of uses. A code stops working the moment its uses run out."
        action={<AddButton label="New code" onClick={() => setCreating(true)} />}
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
                <th>Code</th><th>Value</th><th>Uses</th><th>Works on</th>
                <th>Window</th><th>Given away</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const exhausted = c.max_uses != null && c.used_count >= c.max_uses;
                const expired = Boolean(c.expires_at && new Date(c.expires_at).getTime() < Date.now());
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="block font-mono font-semibold text-ink">{c.code}</span>
                      {c.description && <span className="block text-xs text-ink/55">{c.description}</span>}
                    </td>
                    <td className="font-semibold text-volt-deep">
                      {value(c)}
                      {c.min_spend_paise > 0 && (
                        <span className="block text-[11px] font-normal text-ink/45">
                          over {formatPaise(c.min_spend_paise)}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="block text-sm">{remaining(c)}</span>
                      <span className="block text-[11px] text-ink/45">
                        {c.per_user_limit == null ? "any number each" : `${c.per_user_limit} per person`}
                      </span>
                    </td>
                    <td className="text-xs">{(c.scopes ?? []).join(", ")}</td>
                    <td className="whitespace-nowrap text-xs text-ink/60">
                      {c.starts_at ? new Date(c.starts_at).toLocaleDateString("en-IN") : "now"}
                      {" to "}
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-IN") : "open"}
                    </td>
                    <td>{formatPaise(Number(c.given_away_paise ?? 0))}</td>
                    <td>
                      <span className={!c.active || exhausted || expired ? "chip" : "chip-volt"}>
                        {!c.active ? "Off" : exhausted ? "Used up" : expired ? "Expired" : "Live"}
                      </span>
                    </td>
                    <td>
                      <button type="button" onClick={() => setEditing(c)} className="btn-outline btn-sm">
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

      {(creating || editing) && (
        <RecordEditor
          title={editing ? editing.code : "New discount code"}
          sub={
            editing
              ? `${editing.used_count} redemption${editing.used_count === 1 ? "" : "s"} so far. The code itself cannot be renamed.`
              : "Live at checkout as soon as you save."
          }
          fields={editing ? FIELDS.filter((f) => f.name !== "code") : FIELDS}
          initial={
            editing
              ? {
                  kind: editing.kind,
                  percent_off: editing.percent_off != null ? Number(editing.percent_off) : null,
                  amount_off_paise: editing.amount_off_paise,
                  max_discount_paise: editing.max_discount_paise,
                  min_spend_paise: editing.min_spend_paise,
                  max_uses: editing.max_uses,
                  per_user_limit: editing.per_user_limit,
                  scopes: editing.scopes ?? [],
                  starts_at: editing.starts_at ? editing.starts_at.slice(0, 10) : "",
                  expires_at: editing.expires_at ? editing.expires_at.slice(0, 10) : "",
                  description: editing.description ?? "",
                  active: editing.active,
                }
              : {
                  kind: "percent",
                  percent_off: 10,
                  min_spend_paise: 0,
                  max_uses: 50,
                  per_user_limit: 1,
                  scopes: ["shop", "games", "coaching", "tournaments"],
                  active: true,
                }
          }
          submitLabel={editing ? "Save code" : "Create code"}
          deleteLabel={editing ? "Delete or switch off" : undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const err = editing
              ? await submitResource("/api/admin/discounts", "PATCH", { id: editing.id, ...values })
              : await submitResource("/api/admin/discounts", "POST", values);
            if (!err) await load();
            return err;
          }}
          onDelete={
            editing
              ? async () => {
                  // A code nobody used is deleted outright; one with redemptions
                  // behind it is switched off so reporting keeps its history.
                  const err = await submitResource(`/api/admin/discounts?id=${editing.id}`, "DELETE");
                  if (err) return err;
                  await load();
                  return null;
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
