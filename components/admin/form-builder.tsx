"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Drawer, RecordEditor, submitResource, type FieldDef } from "@/components/admin/crud";
import { Alert, Spinner } from "@/components/ui";

export type BuilderField = {
  id: string;
  field_key: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  help: string | null;
  sort_order: number;
};

const TYPES = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Paragraph" },
  { value: "number", label: "Number" },
  { value: "select", label: "Choose one" },
  { value: "checkbox", label: "Tick box" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

const FIELD_DEFS: FieldDef[] = [
  { name: "label", label: "Question", required: true, full: true, placeholder: "T-shirt size" },
  { name: "type", label: "Answer type", type: "select", options: TYPES },
  { name: "sort_order", label: "Position", type: "number" },
  {
    name: "options",
    label: "Choices",
    type: "list",
    placeholder: "S\nM\nL\nXL",
    hint: "One per line. Only used by “Choose one”.",
  },
  { name: "help", label: "Helper text", full: true, placeholder: "Shown under the question" },
  { name: "required", label: "Answer is required", type: "checkbox" },
];

/**
 * Per-tournament entry-form builder.
 *
 * The player's own details (name, phone, email, DUPR) are always collected and
 * pre-filled from their account, so this only covers what a particular draw
 * additionally needs. Deleting a question stops it being asked but leaves
 * answers already collected on their registrations.
 */
export function FormBuilder({
  tournamentId,
  tournamentTitle,
  onClose,
}: {
  tournamentId: string;
  tournamentTitle: string;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BuilderField | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tournament-form?tournament_id=${tournamentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the form.");
      setFields(data.fields ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the form.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function move(field: BuilderField, direction: -1 | 1) {
    const ordered = [...fields].sort((a, b) => a.sort_order - b.sort_order);
    const i = ordered.findIndex((f) => f.id === field.id);
    const j = i + direction;
    if (j < 0 || j >= ordered.length) return;
    // Swap the two positions and persist both, so the order survives a reload.
    await submitResource("/api/admin/tournament-form", "PATCH", { id: ordered[i].id, sort_order: j });
    await submitResource("/api/admin/tournament-form", "PATCH", { id: ordered[j].id, sort_order: i });
    load();
  }

  return (
    <Drawer title="Entry form" sub={tournamentTitle} onClose={onClose}>
      <div className="rounded-xl border border-line bg-mist p-4">
        <p className="text-sm font-semibold text-ink">Always collected</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">
          Team name, both players&apos; names, phone numbers and DUPR, plus an email. Signed-in players get
          these filled in from their account — they only answer what you add below.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <h3 className="text-xl">Your questions</h3>
        <button type="button" onClick={() => setCreating(true)} className="btn-volt btn-sm">
          <Plus size={14} /> Add
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner />
        </div>
      ) : fields.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink/50">
          No extra questions. The form asks only for the standard team details.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {[...fields]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((f, i, arr) => (
              <li key={f.id} className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3">
                <GripVertical size={15} className="mt-1 shrink-0 text-ink/25" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {f.label}
                    {f.required && <span className="ml-1 text-signal">*</span>}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
                    {TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                    {f.options?.length > 0 ? ` · ${f.options.length} choices` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(f, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${f.label} up`}
                    className="rounded-md p-1.5 text-ink/45 hover:bg-mist hover:text-ink disabled:opacity-25"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(f, 1)}
                    disabled={i === arr.length - 1}
                    aria-label={`Move ${f.label} down`}
                    className="rounded-md p-1.5 text-ink/45 hover:bg-mist hover:text-ink disabled:opacity-25"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(f)}
                    aria-label={`Edit ${f.label}`}
                    className="rounded-md p-1.5 text-ink/45 hover:bg-mist hover:text-ink"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await submitResource(`/api/admin/tournament-form?id=${f.id}`, "DELETE");
                      load();
                    }}
                    aria-label={`Delete ${f.label}`}
                    className="rounded-md p-1.5 text-ink/45 hover:bg-signal/10 hover:text-signal"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}

      {(creating || editing) && (
        <RecordEditor
          title={editing ? "Edit question" : "New question"}
          fields={FIELD_DEFS}
          initial={
            editing
              ? {
                  label: editing.label,
                  type: editing.type,
                  sort_order: editing.sort_order,
                  options: editing.options ?? [],
                  help: editing.help ?? "",
                  required: editing.required,
                }
              : { type: "text", sort_order: fields.length, options: [], required: false }
          }
          submitLabel={editing ? "Save question" : "Add question"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const err = editing
              ? await submitResource("/api/admin/tournament-form", "PATCH", { id: editing.id, ...values })
              : await submitResource("/api/admin/tournament-form", "POST", {
                  tournament_id: tournamentId,
                  ...values,
                });
            if (!err) await load();
            return err;
          }}
          onDelete={
            editing
              ? async () => {
                  const err = await submitResource(`/api/admin/tournament-form?id=${editing.id}`, "DELETE");
                  if (!err) await load();
                  return err;
                }
              : undefined
          }
        />
      )}
    </Drawer>
  );
}
