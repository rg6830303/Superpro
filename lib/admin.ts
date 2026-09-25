import { NextResponse } from "next/server";
import { getAdminSession, type AdminPayload } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * Gate for every /api/admin route. Returns the session, or a 401 Response the
 * handler should return as-is:
 *
 *   const gate = await adminGate();
 *   if (gate instanceof NextResponse) return gate;
 */
export async function adminGate(): Promise<AdminPayload | NextResponse> {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  return session;
}

/** Append-only trail of who changed what, shown on the admin dashboard. */
export async function audit(
  admin: AdminPayload,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await query(
    `INSERT INTO audit_log (admin_email, action, entity, entity_id, meta) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [admin.email, action, entity ?? null, entityId ?? null, meta ? JSON.stringify(meta) : null],
  ).catch((err) => console.error("[audit]", err instanceof Error ? err.message : err));
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(scope: string, err: unknown) {
  console.error(`[admin:${scope}]`, err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/**
 * Build a parameterised UPDATE from a patch object, restricted to an explicit
 * column allowlist. Column names are never interpolated from user input — only
 * keys that appear in `allowed` reach the SQL string.
 */
export function buildUpdate(
  table: string,
  allowed: readonly string[],
  patch: Record<string, unknown>,
  idColumn = "id",
): { text: string; params: unknown[] } | null {
  const entries = Object.entries(patch).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) return null;

  // JSONB values are cast via text. Assigning a JSON string straight to a jsonb
  // column stores it as a jsonb *string*, not the list it spells — which is
  // how every admin edit was turning product specs, galleries, coach
  // specialties and tournament categories into strings the site then read as
  // empty (or, for a gallery, iterated letter by letter).
  const sets = entries.map(([k, v], i) => (v instanceof JsonbValue ? `${k} = $${i + 1}::text::jsonb` : `${k} = $${i + 1}`));
  const params = entries.map(([, v]) => (v instanceof JsonbValue ? v.text : v));
  params.push(patch[idColumn] ?? patch.id);

  return {
    text: `UPDATE ${table} SET ${sets.join(", ")} WHERE ${idColumn} = $${params.length} RETURNING *`,
    params,
  };
}

/** A value bound for a jsonb column; buildUpdate casts it properly. */
export class JsonbValue {
  constructor(readonly text: string) {}
  /** So the audit log records the value itself, not a wrapper. */
  toJSON(): unknown {
    try {
      return JSON.parse(this.text);
    } catch {
      return this.text;
    }
  }
}

/**
 * Mark the JSONB columns in a patch. Values are serialised once (a string the
 * client already serialised is kept as-is) and wrapped, so buildUpdate knows
 * to cast them rather than store the JSON as a quoted string.
 */
export function jsonbFields<T extends Record<string, unknown>>(patch: T, fields: string[]): T {
  const out = { ...patch } as Record<string, unknown>;
  for (const f of fields) {
    if (f in out && out[f] !== undefined && out[f] !== null) {
      out[f] = new JsonbValue(typeof out[f] === "string" ? (out[f] as string) : JSON.stringify(out[f]));
    }
  }
  return out as T;
}
