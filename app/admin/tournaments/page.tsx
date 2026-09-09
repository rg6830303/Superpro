"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Megaphone, Pencil, Users } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import {
  AddButton,
  Drawer,
  ListState,
  RecordEditor,
  submitResource,
  type FieldDef,
} from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";
import { formatDateRange } from "@/lib/dates";
import { formatPaise } from "@/lib/money";

type Tournament = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  city: string;
  format: string | null;
  categories: string[];
  prize_pool_paise: number;
  entry_fee_paise: number;
  max_teams: number;
  dupr_cap: number | null;
  summary: string | null;
  description: string | null;
  result_note: string | null;
  registration_open: boolean;
  partner_name: string | null;
  teams: number;
};

type Entry = {
  id: string;
  reference: string | null;
  team_name: string;
  category: string | null;
  player1_name: string;
  player1_phone: string;
  player1_dupr: number | null;
  player2_name: string | null;
  player2_dupr: number | null;
  group_name: string | null;
  seed: number | null;
  payment_status: string;
  status: string;
};

const FIELDS: FieldDef[] = [
  { name: "title", label: "Title", required: true, full: true },
  { name: "slug", label: "URL slug", required: true, hint: "lowercase-with-dashes" },
  {
    name: "kind",
    label: "Our role",
    type: "select",
    options: [
      { value: "organized", label: "We organise" },
      { value: "sponsored", label: "We sponsor" },
    ],
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "announced", label: "Announced" },
      { value: "open", label: "Open for entries" },
      { value: "closed", label: "Entries closed" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
  { name: "start_date", label: "Start date", type: "date" },
  { name: "end_date", label: "End date", type: "date" },
  { name: "venue", label: "Venue", full: true },
  { name: "city", label: "City" },
  { name: "format", label: "Format", placeholder: "Round robin into knockouts" },
  { name: "categories", label: "Categories", type: "list", placeholder: "Men's Doubles\nMixed Doubles" },
  { name: "prize_pool_paise", label: "Prize pool (paise)", type: "number", hint: "2500000 = ₹25,000" },
  { name: "entry_fee_paise", label: "Entry fee (paise)", type: "number" },
  { name: "max_teams", label: "Max teams", type: "number" },
  { name: "dupr_cap", label: "Team DUPR cap", type: "number" },
  { name: "summary", label: "Summary", type: "textarea" },
  { name: "description", label: "Full description", type: "textarea" },
  { name: "result_note", label: "Result note", full: true, placeholder: "Winners: …" },
  { name: "partner_name", label: "Partner / organiser", full: true },
  { name: "registration_open", label: "Accept entries now", type: "checkbox" },
];

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [creating, setCreating] = useState(false);
  const [drawFor, setDrawFor] = useState<Tournament | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tournaments");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load tournaments.");
      setTournaments(data.tournaments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tournaments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNow = tournaments.filter((t) => t.registration_open).length;
  const totalTeams = tournaments.reduce((n, t) => n + (t.teams ?? 0), 0);

  return (
    <div>
      <AdminHeader
        title="Tournaments"
        sub="Announcements, entries and the draw."
        action={<AddButton label="New tournament" onClick={() => setCreating(true)} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Listed" value={tournaments.length} />
        <StatTile label="Accepting entries" value={openNow} tone="accent" />
        <StatTile label="Teams entered" value={totalTeams} />
      </div>

      <ListState loading={loading} error={error} empty={tournaments.length === 0} emptyLabel="No tournaments yet." />

      {!loading && tournaments.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Tournament</th>
                <th>Dates</th>
                <th>Role</th>
                <th>Teams</th>
                <th>Prize</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="block font-semibold text-ink">{t.title}</span>
                    <span className="block text-xs text-ink/55">{t.venue ?? t.city}</span>
                  </td>
                  <td className="whitespace-nowrap text-xs">{formatDateRange(t.start_date, t.end_date)}</td>
                  <td>
                    <span className={t.kind === "sponsored" ? "chip" : "chip-volt"}>
                      {t.kind === "sponsored" ? "Sponsor" : "Organiser"}
                    </span>
                  </td>
                  <td>
                    {t.teams}/{t.max_teams}
                  </td>
                  <td>{t.prize_pool_paise > 0 ? formatPaise(t.prize_pool_paise) : "—"}</td>
                  <td>
                    <span className={t.registration_open ? "chip-volt" : "chip"}>{t.status}</span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(t)} className="btn-outline btn-sm">
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => setDrawFor(t)} className="btn-outline btn-sm">
                        <Layers size={13} /> Draw
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <RecordEditor
          title={editing ? editing.title : "New tournament"}
          fields={FIELDS}
          initial={
            editing
              ? {
                  title: editing.title,
                  slug: editing.slug,
                  kind: editing.kind,
                  status: editing.status,
                  start_date: editing.start_date?.slice(0, 10) ?? "",
                  end_date: editing.end_date?.slice(0, 10) ?? "",
                  venue: editing.venue ?? "",
                  city: editing.city,
                  format: editing.format ?? "",
                  categories: editing.categories ?? [],
                  prize_pool_paise: editing.prize_pool_paise,
                  entry_fee_paise: editing.entry_fee_paise,
                  max_teams: editing.max_teams,
                  dupr_cap: editing.dupr_cap != null ? Number(editing.dupr_cap) : null,
                  summary: editing.summary ?? "",
                  description: editing.description ?? "",
                  result_note: editing.result_note ?? "",
                  partner_name: editing.partner_name ?? "",
                  registration_open: editing.registration_open,
                }
              : {
                  kind: "organized",
                  status: "announced",
                  city: "Kolkata",
                  categories: [],
                  prize_pool_paise: 0,
                  entry_fee_paise: 0,
                  max_teams: 16,
                  registration_open: false,
                }
          }
          submitLabel={editing ? "Save tournament" : "Create tournament"}
          deleteLabel="Cancel event"
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const payload = { ...values };
            // Empty date strings must become null, not "".
            for (const k of ["start_date", "end_date"]) {
              if (payload[k] === "") payload[k] = null;
            }
            const err = editing
              ? await submitResource("/api/admin/tournaments", "PATCH", { id: editing.id, ...payload })
              : await submitResource("/api/admin/tournaments", "POST", payload);
            if (!err) await load();
            return err;
          }}
          onDelete={
            editing
              ? async () => {
                  const err = await submitResource(`/api/admin/tournaments?id=${editing.id}`, "DELETE");
                  if (!err) await load();
                  return err;
                }
              : undefined
          }
        />
      )}

      {drawFor && <DrawDrawer tournament={drawFor} onClose={() => setDrawFor(null)} onChanged={load} />}
    </div>
  );
}

/** Entries, auto-grouping and publishing the draw to WhatsApp. */
function DrawDrawer({
  tournament,
  onClose,
  onChanged,
}: {
  tournament: Tournament;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupSize, setGroupSize] = useState(4);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/tournament-registrations?tournament_id=${tournament.id}`);
    const data = await res.json();
    if (res.ok) setEntries(data.registrations ?? []);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(body: Record<string, unknown>, okMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tournament_id: tournament.id, ...body }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "That did not work.");
    setNotice(okMessage);
    await load();
    onChanged();
  }

  return (
    <Drawer title="The draw" sub={`${tournament.title} · ${entries.length} entries`} onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      {notice && (
        <div className="mb-4">
          <Alert tone="ok">{notice}</Alert>
        </div>
      )}

      <div className="card p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Users size={14} className="text-volt-deep" /> Auto-group
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink/55">
          Rebuilds the draw, snake-seeding confirmed teams by combined DUPR so every group is comparable in
          strength. Existing groups are replaced.
        </p>
        <div className="mt-4 flex items-end gap-3">
          <div>
            <label className="label" htmlFor="grp-size">Teams per group</label>
            <input
              id="grp-size"
              type="number"
              min={2}
              max={8}
              className="field w-24"
              value={groupSize}
              onChange={(e) => setGroupSize(Number(e.target.value))}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => action({ action: "auto", group_size: groupSize }, "Groups rebuilt.")}
            className="btn-volt btn-sm"
          >
            {busy ? <Spinner size={13} /> : <Layers size={13} />} Generate
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => action({ action: "publish" }, "Draw posted to the group.")}
            className="btn-outline btn-sm"
          >
            <Megaphone size={13} /> Publish
          </button>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-xl">Entries</h3>
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <p className="mt-3 text-sm text-ink/55">No teams have entered yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {entries.map((e) => (
              <li key={e.id} className="rounded-xl border border-line bg-mist p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{e.team_name}</p>
                    <p className="text-xs text-ink/65">
                      {e.player1_name}
                      {e.player1_dupr ? ` (${Number(e.player1_dupr).toFixed(2)})` : ""}
                      {e.player2_name ? ` & ${e.player2_name}` : " — needs a partner"}
                      {e.player2_dupr ? ` (${Number(e.player2_dupr).toFixed(2)})` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-ink/45">
                      {e.player1_phone} · {e.category ?? "no category"}
                      {e.group_name ? ` · ${e.group_name}` : ""}
                    </p>
                  </div>
                  <select
                    defaultValue={e.status}
                    aria-label={`Status for ${e.team_name}`}
                    className="field shrink-0 px-2 py-1 text-xs"
                    onChange={async (ev) => {
                      await submitResource("/api/admin/tournament-registrations", "PATCH", {
                        id: e.id,
                        status: ev.target.value,
                      });
                      load();
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="waitlist">Waitlist</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
