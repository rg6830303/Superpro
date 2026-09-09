"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { AddButton, ListState, RecordEditor, submitResource, type FieldDef } from "@/components/admin/crud";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";

type Coach = {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  bio: string | null;
  specialties: string[];
  dupr: number | null;
  experience_years: number;
  rate_paise: number;
  languages: string | null;
  whatsapp: string | null;
  available_days: string[];
  active: boolean;
  sort_order: number;
  bookings: number;
};

type Booking = {
  id: string;
  booking_no: string;
  coach_name: string;
  player_name: string;
  player_phone: string;
  session_type: string;
  sessions_count: number;
  preferred_date: string | null;
  preferred_time: string | null;
  amount_paise: number;
  payment_status: string;
  status: string;
};

const COACH_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", required: true },
  { name: "slug", label: "URL slug", required: true, hint: "lowercase-with-dashes" },
  { name: "headline", label: "Headline", full: true, placeholder: "Head coach · DUPR 5.4 · third-shot discipline" },
  { name: "bio", label: "Bio", type: "textarea" },
  { name: "specialties", label: "Specialties", type: "list", placeholder: "One per line" },
  { name: "available_days", label: "Available days", type: "list", placeholder: "Mon\nTue\nWed" },
  { name: "dupr", label: "DUPR rating", type: "number" },
  { name: "experience_years", label: "Years coaching", type: "number" },
  { name: "rate_paise", label: "Rate per session (paise)", type: "number", hint: "150000 = ₹1,500" },
  { name: "languages", label: "Languages" },
  { name: "whatsapp", label: "WhatsApp number", hint: "With country code, e.g. 919830000000" },
  { name: "sort_order", label: "Sort order", type: "number" },
  { name: "active", label: "Listed on the site", type: "checkbox" },
];

const STATUSES = ["requested", "confirmed", "completed", "cancelled"];

export default function AdminCoachingPage() {
  const [tab, setTab] = useState<"coaches" | "bookings">("coaches");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, b] = await Promise.all([
        fetch("/api/admin/coaches").then((r) => r.json()),
        fetch("/api/admin/coaching").then((r) => r.json()),
      ]);
      if (c.error) throw new Error(c.error);
      setCoaches(c.coaches ?? []);
      setBookings(b.bookings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load coaching.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = bookings.filter((b) => b.status === "requested").length;

  return (
    <div>
      <AdminHeader
        title="Coaching"
        sub="Coach roster and session requests."
        action={<AddButton label="Add coach" onClick={() => setCreating(true)} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Active coaches" value={coaches.filter((c) => c.active).length} />
        <StatTile label="Requests waiting" value={pending} tone={pending > 0 ? "accent" : "default"} />
        <StatTile label="Total bookings" value={bookings.length} />
      </div>

      <div className="mb-5 flex gap-2">
        {(["coaches", "bookings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-volt text-ink" : "border border-line text-ink/70 hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <ListState
        loading={loading}
        error={error}
        empty={tab === "coaches" ? coaches.length === 0 : bookings.length === 0}
        emptyLabel={tab === "coaches" ? "No coaches yet." : "No coaching requests yet."}
      />

      {tab === "coaches" && !loading && coaches.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Coach</th>
                <th>DUPR</th>
                <th>Experience</th>
                <th>Rate</th>
                <th>Bookings</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="block font-semibold text-ink">{c.name}</span>
                    <span className="block text-xs text-ink/55">{c.headline ?? "—"}</span>
                  </td>
                  <td>{c.dupr != null ? Number(c.dupr).toFixed(1) : "—"}</td>
                  <td>{c.experience_years} yrs</td>
                  <td>{formatPaise(c.rate_paise)}</td>
                  <td>{c.bookings}</td>
                  <td>
                    <span className={c.active ? "chip-volt" : "chip"}>{c.active ? "Listed" : "Hidden"}</span>
                  </td>
                  <td>
                    <button type="button" onClick={() => setEditing(c)} className="btn-outline btn-sm">
                      <Pencil size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bookings" && !loading && bookings.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Player</th>
                <th>Coach</th>
                <th>Preferred</th>
                <th>Sessions</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono text-xs text-volt-deep">{b.booking_no}</td>
                  <td>
                    <span className="block font-semibold text-ink">{b.player_name}</span>
                    <span className="block text-xs text-ink/55">{b.player_phone}</span>
                  </td>
                  <td>{b.coach_name}</td>
                  <td className="whitespace-nowrap text-xs">
                    {b.preferred_date ? `${formatDate(b.preferred_date)} · ${b.preferred_time}` : "—"}
                  </td>
                  <td>
                    {b.sessions_count} × {b.session_type}
                  </td>
                  <td>{formatPaise(b.amount_paise)}</td>
                  <td>
                    <span className={b.payment_status === "paid" ? "chip-volt" : "chip-warn"}>{b.payment_status}</span>
                  </td>
                  <td>
                    <select
                      defaultValue={b.status}
                      aria-label={`Status for ${b.booking_no}`}
                      className="field px-2 py-1 text-sm"
                      onChange={async (e) => {
                        await submitResource("/api/admin/coaching", "PATCH", { id: b.id, status: e.target.value });
                        load();
                      }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="capitalize">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <RecordEditor
          title={editing ? editing.name : "New coach"}
          sub={editing ? `${editing.bookings} bookings` : "Appears on the public coaching page."}
          fields={COACH_FIELDS}
          initial={
            editing
              ? {
                  name: editing.name,
                  slug: editing.slug,
                  headline: editing.headline ?? "",
                  bio: editing.bio ?? "",
                  specialties: editing.specialties ?? [],
                  available_days: editing.available_days ?? [],
                  dupr: editing.dupr != null ? Number(editing.dupr) : null,
                  experience_years: editing.experience_years,
                  rate_paise: editing.rate_paise,
                  languages: editing.languages ?? "",
                  whatsapp: editing.whatsapp ?? "",
                  sort_order: editing.sort_order,
                  active: editing.active,
                }
              : {
                  experience_years: 1,
                  rate_paise: 120000,
                  languages: "English, Hindi, Bengali",
                  specialties: [],
                  available_days: [],
                  sort_order: 0,
                  active: true,
                }
          }
          submitLabel={editing ? "Save coach" : "Add coach"}
          deleteLabel="Remove from site"
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const err = editing
              ? await submitResource("/api/admin/coaches", "PATCH", { id: editing.id, ...values })
              : await submitResource("/api/admin/coaches", "POST", values);
            if (!err) await load();
            return err;
          }}
          onDelete={
            editing
              ? async () => {
                  const err = await submitResource(`/api/admin/coaches?id=${editing.id}`, "DELETE");
                  if (!err) await load();
                  return err;
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
