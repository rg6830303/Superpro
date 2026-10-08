"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { ListState, RecordEditor, submitResource, type FieldDef } from "@/components/admin/crud";
import { formatPaise } from "@/lib/money";

type Appt = {
  id: string; reference: string; name: string; phone: string; email: string | null; age: number; gender: string;
  concern: string; details: string | null; preferred_date: string; preferred_slot: string; confirmed_at: string | null;
  amount_paise: number; payment_status: string; paid_at: string | null; status: string; admin_note: string | null; created_at: string;
};

const FIELDS: FieldDef[] = [
  { name: "status", label: "Status", type: "select", options: ["requested", "confirmed", "completed", "cancelled"].map((v) => ({ value: v, label: v })) },
  { name: "payment_status", label: "Payment", type: "select", options: ["unpaid", "pending", "paid", "refunded"].map((v) => ({ value: v, label: v })), hint: "Mark paid for cash / UPI taken at the clinic." },
  { name: "preferred_date", label: "Date", type: "date" },
  { name: "preferred_slot", label: "Time window" },
  { name: "confirmed_at", label: "Confirmed time", hint: "e.g. 2026-10-12 17:30 — the exact appointment time agreed with the patient." },
  { name: "admin_note", label: "Note", type: "textarea" },
];

const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null);

export default function AdminDoctorPage() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Appt | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("open");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/doctor-appointments").then((x) => x.json());
      if (r.error) throw new Error(r.error);
      setAppts(r.appointments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load appointments.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return appts.filter(
      (a) =>
        (filter === "all" || (filter === "open" ? a.status === "requested" || a.status === "confirmed" : a.status === filter)) &&
        (!n || `${a.name} ${a.phone} ${a.reference} ${a.concern}`.toLowerCase().includes(n)),
    );
  }, [appts, q, filter]);
  const paid = appts.filter((a) => a.payment_status === "paid");

  return (
    <div>
      <AdminHeader title="Doctor appointments" sub="Clinic consultations booked and paid on the site." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label="Awaiting confirmation" value={appts.filter((a) => a.status === "requested").length} tone="accent" />
        <StatTile label="Confirmed" value={appts.filter((a) => a.status === "confirmed").length} />
        <StatTile label="Paid" value={paid.length} />
        <StatTile label="Collected" value={formatPaise(paid.reduce((s, a) => s + a.amount_paise, 0))} />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input className="field !pl-9" placeholder="Search name, phone, reference or concern" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="field sm:w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Open</option>
          <option value="requested">Requested</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">Everything</option>
        </select>
      </div>

      <ListState loading={loading} error={error} empty={appts.length === 0} emptyLabel="No consultations booked yet. They arrive from the Medical page on the demo site." />

      {!loading && shown.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Patient</th><th>Concern</th><th>When</th><th>Payment</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="block font-semibold text-ink">{a.name}</span>
                    <span className="block text-[11px] text-ink/55">{a.phone} · {a.age} yrs · {a.gender} · {a.reference}</span>
                  </td>
                  <td className="max-w-[16rem] text-xs">{a.concern}{a.details && <span className="block text-ink/55">{a.details}</span>}</td>
                  <td className="text-xs">
                    {fmtTime(a.confirmed_at) ? <span className="font-semibold text-ink">{fmtTime(a.confirmed_at)}</span> : <>{fmtDay(a.preferred_date)}<span className="block text-ink/55">{a.preferred_slot}</span></>}
                  </td>
                  <td><span className={a.payment_status === "paid" ? "chip-volt" : "chip-warn"}>{a.payment_status}</span><span className="mt-1 block text-[11px] text-ink/50">{formatPaise(a.amount_paise)}</span></td>
                  <td><span className="chip">{a.status}</span></td>
                  <td><button type="button" onClick={() => setEditing(a)} className="btn-outline btn-sm"><Pencil size={13} /> Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RecordEditor
          title={editing.name}
          sub={`${editing.reference} · ${editing.concern} · ${editing.phone}`}
          fields={FIELDS}
          initial={{
            status: editing.status,
            payment_status: editing.payment_status,
            preferred_date: editing.preferred_date,
            preferred_slot: editing.preferred_slot,
            confirmed_at: editing.confirmed_at ? new Date(editing.confirmed_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16) : "",
            admin_note: editing.admin_note ?? "",
          }}
          submitLabel="Save"
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            const confirmed = String(v.confirmed_at ?? "").trim();
            const err = await submitResource("/api/admin/doctor-appointments", "PATCH", {
              id: editing.id,
              status: v.status,
              payment_status: v.payment_status,
              preferred_date: v.preferred_date,
              preferred_slot: v.preferred_slot,
              // Entered as Kolkata time.
              confirmed_at: confirmed ? `${confirmed.replace(" ", "T")}:00+05:30` : "",
              admin_note: v.admin_note || null,
            });
            if (!err) await load();
            return err;
          }}
          onDelete={async () => {
            const err = await submitResource(`/api/admin/doctor-appointments?id=${editing.id}`, "DELETE");
            if (!err) await load();
            return err;
          }}
        />
      )}
    </div>
  );
}
