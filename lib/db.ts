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
    // A small pool, not a single socket. With max:1 one slow query blocks every
    // other query on the instance (head-of-line blocking), which is what made
    // page loads hang. The Supabase transaction pooler multiplexes these onto a
    // handful of real backends, so a few per instance is cheap.
    max: 5,
    // pgbouncer transaction mode cannot hold prepared statements.
    prepare: false,
    // Never pipeline. Without prepared statements, every query that has
    // parameters runs in two steps — Parse/Describe, wait for the server's
    // reply, then Bind — and when all connections are busy postgres.js slips
    // the next query onto one of them mid-exchange. Behind the transaction
    // pooler that interleaving leaves the backend waiting on a Bind that never
    // comes ("active / ClientRead"), holding its read locks indefinitely.
    // With pipelining off, a query waits for a free connection instead: a few
    // milliseconds, rather than a page that hangs. Measured: the home page ran
    // six queries on a pool of five and went from ~1s to a reliable 8.8s.
    max_pipeline: 0,
    // Keep the socket warm between consecutive user actions, release when idle.
    idle_timeout: 30,
    connect_timeout: 10,
    ssl: "require",
    onnotice: () => {},
    // max_pipeline is a real runtime option (postgres/src/index.js reads it)
    // that the bundled type definitions leave out.
  } as Parameters<typeof postgres>[1]);
}

export function getSql(): Sql {
  if (!global.__superproSql) global.__superproSql = create();
  return global.__superproSql;
}

/**
 * postgres.js only builds array literals in tagged-template mode; through
 * `unsafe()` a JS array is sent as a bare scalar and Postgres rejects it with
 * `malformed array literal`. So encode arrays ourselves — every call site pairs
 * the placeholder with an explicit cast (`$1::uuid[]`, `$1::text[]`), which is
 * what tells Postgres how to read the literal.
 */
function encodeParam(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const items = value.map((el) => {
    if (el === null || el === undefined) return "NULL";
    const escaped = String(el).split("\\").join("\\\\").split('"').join('\\"');
    return `"${escaped}"`;
  });
  return `{${items.join(",")}}`;
}

/**
 * `$1::jsonb` does not do what it looks like it does.
 *
 * Call sites hand us a JSON *string* (`JSON.stringify(items)`), and with that
 * cast the driver stores it as a jsonb **string scalar** rather than parsing it
 * — so the array comes back out as a string, and code that iterates it walks
 * the characters of the JSON instead of the rows. Going via text first makes
 * Postgres parse the literal, which is what every call site meant. Measured,
 * not assumed: `$1::jsonb` returns jsonb_typeof 'string', `$1::text::jsonb`
 * returns 'array'.
 */
function jsonbSafe(text: string): string {
  return text
    .replace(/(\$\d+)::jsonb/g, "$1::text::jsonb")
    .replace(/COALESCE\((\$\d+)\s*,([^()]*)\)::jsonb/gi, "COALESCE($1::text,$2)::jsonb");
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
  const rows = await sql.unsafe(jsonbSafe(text), params.map(encodeParam) as never[]);
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

/**
 * Run a database read with a hard ceiling, falling back rather than hanging the
 * page. Server components render inside the request, so one slow query that
 * never resolves is a blank page for the visitor — always give reads a bound.
 */
export async function withTimeout<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
  ms = 8000,
): Promise<T> {
  if (!isDbConfigured) return fallback;
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Query timeout")), ms)),
    ]);
  } catch (err) {
    console.error(`[db:${label}]`, err instanceof Error ? err.message : err);
    return fallback;
  }
}
