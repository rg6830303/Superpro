"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { AdminHeader, StatTile } from "@/components/admin/shell";
import { AddButton, ListState, RecordEditor, submitResource, type FieldDef } from "@/components/admin/crud";

type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: "info" | "tournament" | "offer" | "urgent";
  link_url: string | null;
  active: boolean;
  created_at: string;
};

const FIELDS: FieldDef[] = [
  { name: "title", label: "Headline", required: true, full: true },
  { name: "body", label: "Detail", type: "textarea", required: true },
  {
    name: "kind",
    label: "Kind",
    type: "select",
    options: [
      { value: "info", label: "Info" },
      { value: "tournament", label: "Tournament" },
      { value: "offer", label: "Offer" },
      { value: "urgent", label: "Urgent" },
    ],
  },
  { name: "link_url", label: "Links to", full: true, placeholder: "/tournaments/legends-challengers-3" },
  { name: "active", label: "Show on the site", type: "checkbox" },
];

/**
 * The banner that runs across the top of the public home page. Only active
 * announcements are shown, newest first, so scheduling is a matter of toggling
 * the one that should be live.
 */
export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/announcements");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load announcements.");
      setItems(data.announcements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const live = items.filter((a) => a.active).length;

  return (
    <div>
      <AdminHeader
        title="Announcements"
        sub="The banner across the top of the public home page."
        action={<AddButton label="New announcement" onClick={() => setCreating(true)} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Live now" value={live} tone={live > 0 ? "accent" : "default"} />
        <StatTile label="Total" value={items.length} />
        <StatTile label="Shown on site" value={live > 0 ? "Yes" : "None"} />
      </div>

      <ListState loading={loading} error={error} empty={items.length === 0} emptyLabel="No announcements yet." />

      {!loading && items.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Headline</th>
                <th>Kind</th>
                <th>Links to</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="block font-semibold text-ink">{a.title}</span>
                    <span className="block max-w-md truncate text-xs text-ink/55">{a.body}</span>
                  </td>
                  <td className="capitalize">{a.kind}</td>
                  <td className="text-xs text-ink/55">{a.link_url ?? "—"}</td>
                  <td>
                    <span className={a.active ? "chip-volt" : "chip"}>{a.active ? "Live" : "Hidden"}</span>
                  </td>
                  <td>
                    <button type="button" onClick={() => setEditing(a)} className="btn-outline btn-sm">
                      <Pencil size={13} /> Edit
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
          title={editing ? "Edit announcement" : "New announcement"}
          fields={FIELDS}
          initial={
            editing
              ? {
                  title: editing.title,
                  body: editing.body,
                  kind: editing.kind,
                  link_url: editing.link_url ?? "",
                  active: editing.active,
                }
              : { kind: "info", active: true }
          }
          submitLabel={editing ? "Save" : "Publish"}
          deleteLabel="Delete"
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const err = editing
              ? await submitResource("/api/admin/announcements", "PATCH", { id: editing.id, ...values })
              : await submitResource("/api/admin/announcements", "POST", values);
            if (!err) await load();
            return err;
          }}
          onDelete={
            editing
              ? async () => {
                  const err = await submitResource(`/api/admin/announcements?id=${editing.id}`, "DELETE");
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
