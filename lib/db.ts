import postgres from "postgres";

/**
 * Database access layer — Supabase Postgres.
 *
 * POSTGRES_URL must be the Supabase *Transaction pooler* string
 * (…pooler.supabase.com:6543). On Vercel every concurrent lambda opens its own
 * backend against the direct :5432 endpoint, which blows past the connection
 * ceiling and turns into "remaining connection slots are reserved" errors.
 */
const PG_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

export type DbConnInfo = {
  configured: boolean;
  /** Port from the URL — never the host, so this is safe to surface in health checks. */
  port: string | null;
  endpoint: "transaction-pooler" | "direct-or-session" | "unknown";
  pooled: boolean;
};

export function dbConnInfo(): DbConnInfo {
  if (!PG_URL) return { configured: false, port: null, endpoint: "unknown", pooled: false };
  try {
    const u = new URL(PG_URL);
    const port = u.port || null;
    const host = u.hostname.toLowerCase();
    const isPooler = port === "6543" || host.includes("pooler.supabase");
    const isDirect = port === "5432" || host.startsWith("db.");
    return {
      configured: true,
      port,
      endpoint: isPooler ? "transaction-pooler" : isDirect ? "direct-or-session" : "unknown",
      pooled: isPooler,
    };
  } catch {
    return { configured: true, port: null, endpoint: "unknown", pooled: false };
  }
}

export const isDbConfigured = Boolean(PG_URL);

type Sql = ReturnType<typeof postgres>;

declare global {
  // Reuse the pool across HMR reloads in dev so `next dev` doesn't leak clients.
  // eslint-disable-next-line no-var
  var __superproSql: Sql | undefined;
}

function create(): Sql {
  if (!PG_URL) throw new Error("POSTGRES_URL is not set");
  return postgres(PG_URL, {
    // One connection per warm instance — the Supabase pooler multiplexes.
    max: 1,
    // pgbouncer transaction mode cannot hold prepared statements.
    prepare: false,
    // Keep the socket warm between consecutive user actions, release when idle.
    idle_timeout: 30,
    connect_timeout: 5,
    ssl: "require",
    onnotice: () => {},
  });
}

export function getSql(): Sql {
  if (!global.__superproSql) global.__superproSql = create();
  return global.__superproSql;
}

/**
 * Run a parameterised statement with `$1, $2, …` placeholders.
 * Returns plain rows so callers never depend on the driver's result shape.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const sql = getSql();
  const rows = await sql.unsafe(text, params as never[]);
  return rows as unknown as T[];
}

/** Convenience for statements expected to return at most one row. */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Fire-and-forget write; swallows nothing, but returns rowCount-ish info. */
export async function exec(text: string, params: unknown[] = []): Promise<void> {
  await query(text, params);
}

/** Ping used by /api/health/db. */
export async function dbPing(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    await query("SELECT 1 AS ok");
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
