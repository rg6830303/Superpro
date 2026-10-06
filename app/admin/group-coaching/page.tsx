"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, Search, Trash2 } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { AddButton, Drawer, ListState, RecordEditor, submitResource, type FieldDef } from "@/components/admin/crud";
import { DAYS, GENDERS, SKILLS, TIMINGS, VENUES, currentBatch, feeFor, venueById } from "@/lib/coaching-program";
import { formatPaise } from "@/lib/money";

type Coach = { id: string; name: string; slug: string; active: boolean; has_login: boolean; login_email: string | null; last_login_at: string | null; has_code: boolean; registrations: number };
type Group = { id: string; coach_id: string; coach_name: string; name: string; venue: string; days: string[]; start_time: string; end_time: string; starts_on: string; sessions: number; members: number; paid: number };
type Reg = {
  id: string; reference: string; coach_id: string | null; coach_name: string | null; group_id: string | null; group_name: string | null;
  batch: string; name: string; gender: string; phone: string; email: string | null; age: number; skill: string;
  days: string[]; venues: string[]; timings: string[]; emergency_phone: string; emergency_relation: string; medical: string | null;
  pay_venue: string; amount_paise: number; payment_status: string; status: string; coach_note: string | null; created_at: string; paid_at: string | null;
};
type Tab = "registrations" | "groups" | "logins";

const opt = (values: readonly string[], label: (v: string) => string = (v) => v) => values.map((v) => ({ value: v, label: label(v) }));
const VENUE_OPTS = VENUES.map((v) => ({ value: v.id, label: v.name }));
const listHint = (values: readonly string[]) => `One per line. Allowed: ${values.join(", ")}`;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function AdminGroupCoachingPage() {
  const [tab, setTab] = useState<Tab>("registrations");
  const [regs, setRegs] = useState<Reg[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingReg, setEditingReg] = useState<Reg | "new" | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | "new" | null>(null);
  const [loginFor, setLoginFor] = useState<Coach | null>(null);
  const [code, setCode] = useState<{ coach: string; code: string } | null>(null);
  const [q, setQ] = useState("");
  const [payFilter, setPayFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, g, c] = await Promise.all([
        fetch("/api/admin/coaching-registrations").then((x) => x.json()),
        fetch("/api/admin/coaching-groups").then((x) => x.json()),
        fetch("/api/admin/coaches").then((x) => x.json()),
      ]);
      if (r.error || g.error || c.error) throw new Error(r.error || g.error || c.error);
      setRegs(r.registrations ?? []);
      setGroups(g.groups ?? []);
      setCoaches(c.coaches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load group coaching.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const coachOpts = coaches.map((c) => ({ value: c.id, label: c.name }));
  const groupOpts = [{ value: "", label: "No group" }, ...groups.map((g) => ({ value: g.id, label: `${g.name} (${g.coach_name})` }))];

  const REG_FIELDS: FieldDef[] = [
    { name: "name", label: "Name", required: true },
    { name: "phone", label: "Contact", required: true },
    { name: "gender", label: "Gender", type: "select", options: opt(GENDERS) },
    { name: "age", label: "Age", type: "number", required: true },
    { name: "email", label: "Email" },
    { name: "skill", label: "Skill level", type: "select", options: SKILLS.map((s) => ({ value: s.id, label: s.label })) },
    { name: "coach_id", label: "Coach", type: "select", options: coachOpts },
    { name: "group_id", label: "Group", type: "select", options: groupOpts },
    { name: "batch", label: "Batch", hint: "e.g. October 2026" },
    { name: "status", label: "Status", type: "select", options: opt(["registered", "grouped", "confirmed", "cancelled"]) },
    { name: "pay_venue", label: "Venue paid for", type: "select", options: VENUE_OPTS },
    { name: "amount_paise", label: "Amount (paise)", type: "number", hint: "500000 = ₹5,000. Leave as is to use the venue fee." },
    { name: "payment_status", label: "Payment", type: "select", options: opt(["unpaid", "pending", "paid", "refunded"]), hint: "Mark paid for cash / UPI taken at the venue." },
    { name: "days", label: "Preferred days", type: "list", hint: listHint(DAYS) },
    { name: "timings", label: "Preferred timings", type: "list", hint: listHint(TIMINGS) },
    { name: "venues", label: "Preferred venues", type: "list", hint: listHint(VENUES.map((v) => v.id)) },
    { name: "emergency_phone", label: "Emergency contact", required: true },
    { name: "emergency_relation", label: "Relation", required: true },
    { name: "medical", label: "Medical conditions", type: "textarea" },
    { name: "coach_note", label: "Note", type: "textarea" },
  ];
  const GROUP_FIELDS: FieldDef[] = [
    { name: "name", label: "Group name", required: true },
    { name: "coach_id", label: "Coach", type: "select", options: coachOpts },
    { name: "venue", label: "Venue", type: "select", options: VENUE_OPTS },
    { name: "starts_on", label: "First class", type: "date" },
    { name: "start_time", label: "Start time", type: "time" },
    { name: "end_time", label: "End time", type: "time" },
    { name: "sessions", label: "Number of classes", type: "number" },
    { name: "days", label: "Days", type: "list", hint: listHint(DAYS) },
  ];

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return regs.filter(
      (r) =>
        (payFilter === "all" || (payFilter === "paid" ? r.payment_status === "paid" : r.payment_status !== "paid")) &&
        (!n || `${r.name} ${r.phone} ${r.reference} ${r.batch}`.toLowerCase().includes(n)),
    );
  }, [regs, q, payFilter]);

  const paid = regs.filter((r) => r.payment_status === "paid");
  const collected = paid.reduce((s, r) => s + r.amount_paise, 0);
  const waiting = regs.filter((r) => r.status !== "cancelled" && !r.group_id).length;

  async function issueCode(c: Coach) {
    try {
      const res = await fetch("/api/admin/coach-accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "code", coach_id: c.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create a code.");
      setCode({ coach: c.name, code: data.code });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a code.");
    }
  }

  return (
    <div>
      <AdminHeader
        title="Group coaching"
        sub="Batch registrations, groups and coach portal logins. Coach profiles are under Coaching."
        action={
          tab === "registrations" ? <AddButton label="Add registration" onClick={() => setEditingReg("new")} /> :
          tab === "groups" ? <AddButton label="Add group" onClick={() => setEditingGroup("new")} /> : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label="Registrations" value={regs.filter((r) => r.status !== "cancelled").length} />
        <StatTile label="Waiting for a group" value={waiting} tone={waiting ? "accent" : "default"} />
        <StatTile label="Paid" value={paid.length} />
        <StatTile label="Collected" value={formatPaise(collected)} />
      </div>

      <div className="tab-strip mb-5">
        {(["registrations", "groups", "logins"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`tab ${tab === t ? "tab-active" : ""}`}>
            {t === "logins" ? "Coach logins" : t}
          </button>
        ))}
      </div>

      <ListState
        loading={loading}
        error={error}
        empty={tab === "registrations" ? regs.length === 0 : tab === "groups" ? groups.length === 0 : coaches.length === 0}
        emptyLabel={
          tab === "registrations" ? "No registrations yet. They arrive from /coaching/register on the demo site, or add one here."
          : tab === "groups" ? "No groups yet." : "No coaches yet — add one under Coaching."
        }
      />

      {tab === "registrations" && !loading && regs.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input className="field !pl-9" placeholder="Search name, phone, reference or batch" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <select className="field sm:w-40" value={payFilter} onChange={(e) => setPayFilter(e.target.value)}>
              <option value="all">Any payment</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Not paid</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Player</th><th>Batch</th><th>Coach / group</th><th>Venue · fee</th><th>Payment</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="block font-semibold text-ink">{r.name}</span>
                      <span className="block text-[11px] text-ink/55">{r.phone} · {r.age} yrs · {r.reference}</span>
                      {r.medical && <span className="block text-[11px] text-amber-700">⚠ {r.medical}</span>}
                    </td>
                    <td className="text-xs">{r.batch}<span className="block text-ink/45">{fmt(r.created_at)}</span></td>
                    <td className="text-xs">{r.coach_name ?? "—"}<span className="block text-ink/55">{r.group_name ?? "No group"}</span></td>
                    <td className="text-xs">{venueById(r.pay_venue)?.name ?? r.pay_venue}<span className="block font-semibold text-ink">{formatPaise(r.amount_paise)}</span></td>
                    <td>
                      <span className={r.payment_status === "paid" ? "chip-volt" : "chip-warn"}>{r.payment_status}</span>
                      {r.paid_at && <span className="mt-1 block text-[10px] text-ink/45">{fmt(r.paid_at)}</span>}
                    </td>
                    <td><span className="chip">{r.status}</span></td>
                    <td>
                      <button type="button" onClick={() => setEditingReg(r)} className="btn-outline btn-sm"><Pencil size={13} /> Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "groups" && !loading && groups.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Group</th><th>Coach</th><th>Schedule</th><th>Players</th><th>Starts</th><th /></tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td><span className="block font-semibold text-ink">{g.name}</span><span className="block text-[11px] text-ink/55">{venueById(g.venue)?.name ?? g.venue}</span></td>
                  <td className="text-xs">{g.coach_name}</td>
                  <td className="text-xs">{g.days.map((d) => d.slice(0, 3)).join(", ")}<span className="block">{g.start_time}–{g.end_time}</span></td>
                  <td className="text-xs"><span className={g.members >= 3 ? "chip-volt" : "chip-warn"}>{g.members}</span><span className="ml-1 text-ink/55">{g.paid} paid</span></td>
                  <td className="text-xs">{fmt(g.starts_on)}<span className="block text-ink/45">{g.sessions} classes</span></td>
                  <td><button type="button" onClick={() => setEditingGroup(g)} className="btn-outline btn-sm"><Pencil size={13} /> Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "logins" && !loading && coaches.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Coach</th><th>Portal login</th><th>Last sign-in</th><th>Registrations</th><th>Actions</th></tr></thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={c.id}>
                  <td><span className="block font-semibold text-ink">{c.name}</span>{!c.active && <span className="chip mt-1">Hidden</span>}</td>
                  <td className="text-xs">
                    {c.has_login ? <span className="chip-volt">{c.login_email}</span> : c.has_code ? <span className="chip-warn">Code issued, not used</span> : <span className="chip">No login</span>}
                  </td>
                  <td className="text-xs">{fmt(c.last_login_at)}</td>
                  <td className="text-xs">{c.registrations}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {!c.has_login && <button type="button" className="btn-outline btn-sm" onClick={() => void issueCode(c)}><KeyRound size={13} /> {c.has_code ? "New code" : "Issue code"}</button>}
                      <button type="button" className="btn-outline btn-sm" onClick={() => setLoginFor(c)}>{c.has_login ? "Reset password" : "Set login"}</button>
                      {c.has_login && (
                        <button
                          type="button"
                          className="rounded-md p-2 text-ink/40 hover:bg-signal/10 hover:text-signal"
                          aria-label={`Remove ${c.name}'s login`}
                          onClick={async () => {
                            if (!confirm(`Remove ${c.name}'s portal login? Their profile and data stay.`)) return;
                            await submitResource(`/api/admin/coach-accounts?coach_id=${c.id}`, "DELETE");
                            load();
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 pb-3 pt-3 text-xs text-ink/50">Coaches sign in on the demo site at /coach/login. A code is used at /coach/signup and works once.</p>
        </div>
      )}

      {editingReg && (
        <RecordEditor
          title={editingReg === "new" ? "New registration" : editingReg.name}
          sub={editingReg === "new" ? "For walk-ins, phone sign-ups or old Google Form entries." : `${editingReg.reference} · ${editingReg.batch}`}
          fields={REG_FIELDS}
          initial={
            editingReg === "new"
              ? { gender: "Male", skill: "beginner", status: "registered", payment_status: "unpaid", pay_venue: VENUES[0].id, batch: currentBatch(), coach_id: coaches[0]?.id ?? "", group_id: "", days: [], timings: [], venues: [] }
              : { ...editingReg, email: editingReg.email ?? "", medical: editingReg.medical ?? "", coach_note: editingReg.coach_note ?? "", group_id: editingReg.group_id ?? "", coach_id: editingReg.coach_id ?? "" }
          }
          submitLabel={editingReg === "new" ? "Add registration" : "Save"}
          onClose={() => setEditingReg(null)}
          onSubmit={async (v) => {
            const values: Record<string, unknown> = { ...v, group_id: v.group_id || null, coach_id: v.coach_id || null, medical: v.medical || null, coach_note: v.coach_note || null, email: v.email || "" };
            for (const k of ["id", "reference", "coach_name", "group_name", "created_at", "paid_at", "updated_at", "user_id", "razorpay_order_id", "razorpay_payment_id"]) delete values[k];
            if (editingReg === "new" && !values.amount_paise) {
              const fee = feeFor(String(values.pay_venue), Number(values.age));
              if (fee != null) values.amount_paise = fee * 100;
            }
            const err = editingReg === "new"
              ? await submitResource("/api/admin/coaching-registrations", "POST", values)
              : await submitResource("/api/admin/coaching-registrations", "PATCH", { id: editingReg.id, ...values });
            if (!err) await load();
            return err;
          }}
          onDelete={editingReg === "new" ? undefined : async () => {
            const err = await submitResource(`/api/admin/coaching-registrations?id=${editingReg.id}`, "DELETE");
            if (!err) await load();
            return err;
          }}
        />
      )}

      {editingGroup && (
        <RecordEditor
          title={editingGroup === "new" ? "New group" : editingGroup.name}
          sub={editingGroup === "new" ? "Assign players to it from the registration editor or the coach dashboard." : `${editingGroup.members} players · ${editingGroup.paid} paid`}
          fields={GROUP_FIELDS}
          initial={
            editingGroup === "new"
              ? { coach_id: coaches[0]?.id ?? "", venue: VENUES[0].id, starts_on: new Date().toISOString().slice(0, 10), start_time: "18:00", end_time: "19:00", sessions: 8, days: [] }
              : { ...editingGroup }
          }
          submitLabel={editingGroup === "new" ? "Add group" : "Save"}
          onClose={() => setEditingGroup(null)}
          onSubmit={async (v) => {
            const values: Record<string, unknown> = { name: v.name, coach_id: v.coach_id, venue: v.venue, starts_on: v.starts_on, start_time: v.start_time, end_time: v.end_time, sessions: Number(v.sessions), days: v.days };
            const err = editingGroup === "new"
              ? await submitResource("/api/admin/coaching-groups", "POST", values)
              : await submitResource("/api/admin/coaching-groups", "PATCH", { id: editingGroup.id, ...values });
            if (!err) await load();
            return err;
          }}
          onDelete={editingGroup === "new" ? undefined : async () => {
            const err = await submitResource(`/api/admin/coaching-groups?id=${editingGroup.id}`, "DELETE");
            if (!err) await load();
            return err;
          }}
        />
      )}

      {loginFor && (
        <RecordEditor
          title={`${loginFor.has_login ? "Reset login" : "Set login"} · ${loginFor.name}`}
          sub="The coach signs in on the demo site at /coach/login with this email and password."
          fields={[
            { name: "email", label: "Login email", required: true, full: true },
            { name: "password", label: "New password", required: true, full: true, hint: "At least 8 characters. Share it privately." },
          ]}
          initial={{ email: loginFor.login_email ?? "", password: "" }}
          submitLabel="Save login"
          onClose={() => setLoginFor(null)}
          onSubmit={async (v) => {
            const err = await submitResource("/api/admin/coach-accounts", "POST", { action: "password", coach_id: loginFor.id, email: v.email, password: v.password });
            if (!err) await load();
            return err;
          }}
        />
      )}

      {code && (
        <Drawer title="Coach sign-up code" sub={`For ${code.coach}. Shown once — copy it now.`} onClose={() => setCode(null)} footer={<button type="button" className="btn-primary w-full" onClick={() => setCode(null)}>Done</button>}>
          <p className="rounded-xl border border-line bg-mist px-4 py-5 text-center font-mono text-2xl tracking-[0.2em] text-ink">{code.code}</p>
          <p className="mt-4 text-sm text-ink/65">The coach goes to <strong>/coach/signup</strong> on the demo site and enters this code with their email and a password. It works once; issuing a new code cancels this one.</p>
          <button type="button" className="btn-outline mt-4 w-full" onClick={() => void navigator.clipboard?.writeText(code.code)}>Copy code</button>
        </Drawer>
      )}
    </div>
  );
}
