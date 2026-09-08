"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";

/**
 * Small CRUD kit shared by every admin resource page. Deliberately plain: a
 * drawer, a set of field renderers, and a fetch helper — enough to add, edit
 * and remove any row without each page reinventing the same form plumbing.
 */

export type FieldType = "text" | "number" | "money" | "textarea" | "select" | "checkbox" | "date" | "time" | "list";

export type FieldDef = {
  name: string;
  label: string;
  type?: FieldType;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  /** Half-width on wide screens (default) or full row. */
  full?: boolean;
};

export type RecordValues = Record<string, unknown>;

export function Drawer({
  title,
  sub,
  onClose,
  children,
  footer,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-ink-900">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <h2 className="text-3xl">{title}</h2>
            {sub && <p className="mt-1 text-xs text-bone/45">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-bone/60 hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="border-t border-white/10 p-6">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${def.name}`;
  const common = "field";

  if (def.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 py-2 text-sm text-bone/70 sm:col-span-2">
        <input
          type="checkbox"
          id={id}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#C79620]"
        />
        <span>
          {def.label}
          {def.hint && <span className="block text-[11px] text-bone/35">{def.hint}</span>}
        </span>
      </label>
    );
  }

  return (
    <div className={def.full || def.type === "textarea" || def.type === "list" ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={id}>
        {def.label}
        {def.required && <span className="ml-1 text-danger">*</span>}
      </label>

      {def.type === "select" ? (
        <select id={id} className={common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : def.type === "textarea" ? (
        <textarea
          id={id}
          rows={3}
          className={`${common} resize-none`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
        />
      ) : def.type === "list" ? (
        <textarea
          id={id}
          rows={3}
          className={`${common} resize-none`}
          value={Array.isArray(value) ? (value as string[]).join("\n") : String(value ?? "")}
          onChange={(e) => onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))}
          placeholder={def.placeholder ?? "One per line"}
        />
      ) : (
        <input
          id={id}
          type={def.type === "date" ? "date" : def.type === "time" ? "time" : "text"}
          inputMode={def.type === "number" || def.type === "money" ? "decimal" : undefined}
          className={common}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(
              def.type === "number" || def.type === "money"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
          placeholder={def.placeholder}
        />
      )}

      {def.hint && <p className="mt-1.5 text-[11px] text-bone/35">{def.hint}</p>}
    </div>
  );
}

/**
 * Editor drawer for one record. `fields` drives the form; `onSubmit` receives
 * the assembled values and returns an error string (or null on success).
 */
export function RecordEditor({
  title,
  sub,
  fields,
  initial,
  submitLabel = "Save",
  onSubmit,
  onDelete,
  deleteLabel = "Delete",
  onClose,
}: {
  title: string;
  sub?: string;
  fields: FieldDef[];
  initial: RecordValues;
  submitLabel?: string;
  onSubmit: (values: RecordValues) => Promise<string | null>;
  onDelete?: () => Promise<string | null>;
  deleteLabel?: string;
  onClose: () => void;
}) {
  const [values, setValues] = useState<RecordValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const err = await onSubmit(values);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  }

  async function remove() {
    if (!onDelete) return;
    setBusy(true);
    setError(null);
    const err = await onDelete();
    setBusy(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Drawer
      title={title}
      sub={sub}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          {onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={remove} disabled={busy} className="btn-danger btn-sm">
                  Confirm
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost btn-sm">
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger btn-sm">
                <Trash2 size={13} /> {deleteLabel}
              </button>
            )
          ) : (
            <span />
          )}
          <button type="button" onClick={save} disabled={busy} className="btn-gold">
            {busy ? <Spinner /> : null} {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field
            key={f.name}
            def={f}
            value={values[f.name]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
          />
        ))}
      </div>
    </Drawer>
  );
}

/** Standard list-page state: fetch, refresh, error. */
export function useResource<T>(url: string, key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (search?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(search ? `${url}${url.includes("?") ? "&" : "?"}q=${encodeURIComponent(search)}` : url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load this list.");
        setItems((data[key] ?? []) as T[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this list.");
      } finally {
        setLoading(false);
      }
    },
    [url, key],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load, setError };
}

/** POST/PATCH/DELETE helper that returns an error string instead of throwing. */
export async function submitResource(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "That did not save.";
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "That did not save.";
  }
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn-gold btn-sm">
      <Plus size={14} /> {label}
    </button>
  );
}

export function ListState({
  loading,
  error,
  empty,
  emptyLabel,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner size={22} />
      </div>
    );
  }
  if (error) return <Alert>{error}</Alert>;
  if (empty) return <p className="card px-6 py-10 text-center text-sm text-bone/45">{emptyLabel}</p>;
  return null;
}
