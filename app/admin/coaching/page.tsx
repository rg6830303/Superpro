"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import {
  AddButton,
  Drawer,
  Field,
  ListState,
  RecordEditor,
  submitResource,
  type FieldDef,
} from "@/components/admin/crud";
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
  email: string | null;
  has_login?: boolean;
  available_days: string[];
  image_url: string | null;
  active: boolean;
  sort_order: number;
  bookings: number;
};

type Availability = {
  id: string;
  coach_id: string;
  coach_name: string;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  { name: "headline", label: "Headline", full: true },
  { name: "bio", label: "Bio", type: "textarea" },
  {
    name: "image_url",
    label: "Photo",
    type: "image",
    folder: "coaches",
    hint: "Shown on the coach card. Portrait or square works best.",
  },
  { name: "specialties", label: "Specialties", type: "list", placeholder: "One per line" },
  { name: "available_days", label: "Available days", type: "list" },
  { name: "dupr", label: "DUPR rating", type: "number" },
  { name: "experience_years", label: "Years coaching", type: "number" },
  { name: "rate_paise", label: "Rate per session (paise)", type: "number", hint: "150000 = ₹1,500" },
  { name: "languages", label: "Languages" },
  { name: "whatsapp", label: "WhatsApp number", hint: "With country code, e.g. 919830000000" },
  {
    name: "email",
    label: "Coach login email",
    hint: "The coach signs up at /coach/signup with exactly this email. Leave blank to keep them off the coach portal.",
  },
  { name: "sort_order", label: "Sort order", type: "number" },
  { name: "active", label: "Listed on the site", type: "checkbox" },
];

const STATUSES = ["requested", "confirmed", "completed", "cancelled"];

export default function AdminCoachingPage() {
  const [tab, setTab] = useState<"coaches" | "availability" | "bookings">("coaches");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [creating, setCreating] = useState(false);
  const [addingSlot, setAddingSlot] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, a, b] = await Promise.all([
        fetch("/api/admin/coaches").then((r) => r.json()),
        fetch("/api/admin/coach-availability").then((r) => r.json()),
        fetch("/api/admin/coaching").then((r) => r.json()),
      ]);
      if (c.error) throw new Error(c.error);
      setCoaches(c.coaches ?? []);
      setAvailability(a.slots ?? []);
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
        action={
          tab === "availability" ? (
            <AddButton label="Add availability" onClick={() => setAddingSlot(true)} />
          ) : (
            <AddButton label="Add coach" onClick={() => setCreating(true)} />
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="Active coaches" value={coaches.filter((c) => c.active).length} />
        <StatTile label="Requests waiting" value={pending} tone={pending > 0 ? "accent" : "default"} />
        <StatTile label="Total bookings" value={bookings.length} />
      </div>

      <div className="tab-strip mb-5">
        {(["coaches", "availability", "bookings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`tab ${tab === t ? "tab-active" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      <ListState
        loading={loading}
        error={error}
        empty={
          tab === "coaches"
            ? coaches.length === 0
            : tab === "availability"
              ? availability.length === 0
              : bookings.length === 0
        }
        emptyLabel={
          tab === "coaches"
            ? "No coaches yet."
            : tab === "availability"
              ? "No availability set. Add the hours each coach is usually on court."
              : "No coaching requests yet."
        }
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
                    <span className="block text-[11px] text-ink/50">
                      {c.has_login ? "Coach portal active" : c.email ? `Invited · ${c.email}` : "No portal login"}
                    </span>
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

      {tab === "availability" && !loading && availability.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Coach</th>
                <th>Day</th>
                <th>From</th>
                <th>To</th>
                <th>Shown</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {availability.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold text-ink">{a.coach_name}</td>
                  <td>{WEEKDAYS[a.weekday]}</td>
                  <td className="font-mono text-xs">{a.start_time}</td>
                  <td className="font-mono text-xs">{a.end_time}</td>
                  <td>
                    <button
                      type="button"
                      className={a.active ? "chip-volt" : "chip"}
                      onClick={async () => {
                        await submitResource("/api/admin/coach-availability", "PATCH", {
                          id: a.id,
                          active: !a.active,
                        });
                        load();
                      }}
                    >
                      {a.active ? "Visible" : "Hidden"}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Delete ${a.coach_name} ${WEEKDAYS[a.weekday]} ${a.start_time}`}
                      onClick={async () => {
                        await submitResource(`/api/admin/coach-availability?id=${a.id}`, "DELETE");
                        load();
                      }}
                      className="rounded-md p-2 text-ink/40 transition-colors hover:bg-signal/10 hover:text-signal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addingSlot && (
        <AvailabilityEditor
          coaches={coaches}
          onClose={() => setAddingSlot(false)}
          onSaved={() => {
            setAddingSlot(false);
            load();
          }}
        />
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
                <th />
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
                      className="field-inline"
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
                  <td>
                    <button
                      type="button"
                      aria-label={`Delete booking ${b.booking_no}`}
                      onClick={async () => {
                        await submitResource(`/api/admin/coaching?id=${b.id}`, "DELETE");
                        load();
                      }}
                      className="rounded-md p-2 text-ink/40 transition-colors hover:bg-signal/10 hover:text-signal"
                    >
                      <Trash2 size={14} />
                    </button>
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
                  image_url: editing.image_url ?? "",
                  specialties: editing.specialties ?? [],
                  available_days: editing.available_days ?? [],
                  dupr: editing.dupr != null ? Number(editing.dupr) : null,
                  experience_years: editing.experience_years,
                  rate_paise: editing.rate_paise,
                  languages: editing.languages ?? "",
                  whatsapp: editing.whatsapp ?? "",
                  email: editing.email ?? "",
                  sort_order: editing.sort_order,
                  active: editing.active,
                }
              : {
                  experience_years: 1,
                  rate_paise: 120000,
                  languages: "English, Hindi, Bengali",
                  image_url: "",
                  specialties: [],
                  available_days: [],
                  sort_order: 0,
                  active: true,
                }
          }
          submitLabel={editing ? "Save coach" : "Add coach"}
          deleteLabel="Delete or hide"
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
                  // A coach who never took a booking is deleted outright;
                  // otherwise the API refuses and we hide them instead.
                  const purge = await submitResource(`/api/admin/coaches?id=${editing.id}&purge=1`, "DELETE");
                  if (purge) {
                    const hidden = await submitResource(`/api/admin/coaches?id=${editing.id}`, "DELETE");
                    if (hidden) return hidden;
                  }
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

/**
 * Availability is added a block at a time — one start/end pair across however
 * many weekdays the coach keeps free — because that is how coaches describe
 * their week ("Mon, Wed, Fri mornings"), not day by day.
 */
function AvailabilityEditor({
  coaches,
  onClose,
  onSaved,
}: {
  coaches: Coach[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [coachId, setCoachId] = useState(coaches[0]?.id ?? "");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const err = await submitResource("/api/admin/coach-availability", "POST", {
      coach_id: coachId,
      weekdays: days,
      start_time: start,
      end_time: end,
    });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }

  return (
    <Drawer
      title="Add availability"
      sub="Recurring weekly hours. Players see these as a guide — the exact date is agreed with the coach."
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={saving || !coachId || days.length === 0}
            onClick={save}
          >
            {saving ? "Saving…" : "Add availability"}
          </button>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancel
          </button>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          def={{
            name: "coach_id",
            label: "Coach",
            type: "select",
            full: true,
            options: coaches.map((c) => ({ value: c.id, label: c.name })),
          }}
          value={coachId}
          onChange={(v) => setCoachId(String(v ?? ""))}
        />
        <Field
          def={{ name: "start", label: "From", type: "time" }}
          value={start}
          onChange={(v) => setStart(String(v ?? ""))}
        />
        <Field
          def={{ name: "end", label: "To", type: "time" }}
          value={end}
          onChange={(v) => setEnd(String(v ?? ""))}
        />

        <div className="sm:col-span-2">
          <p className="label">Days</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((label, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDays(on ? days.filter((d) => d !== i) : [...days, i])}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                    on ? "bg-volt text-ink" : "border border-line text-ink/60 hover:text-ink"
                  }`}
                >
                  {label.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="field-error sm:col-span-2">{error}</p>}
      </div>
    </Drawer>
  );
}
