import { query } from "@/lib/db";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Fixed-window limiter backed by the `rate_limits` table. Fails OPEN — a DB
 * hiccup must never lock every user out of login.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  try {
    const rows = await query<{ count: number; window_start: string }>(
      "SELECT count, window_start FROM rate_limits WHERE key = $1 LIMIT 1",
      [key],
    );
    const row = rows[0];

    if (!row || now - Number(row.window_start) > windowMs) {
      await query(
        `INSERT INTO rate_limits (key, count, window_start) VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE SET count = 1, window_start = EXCLUDED.window_start`,
        [key, now],
      );
      return { ok: true };
    }

    if (Number(row.count) >= maxAttempts) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - Number(row.window_start))) / 1000));
      return { ok: false, retryAfterSec };
    }

    await query("UPDATE rate_limits SET count = count + 1 WHERE key = $1", [key]);
    return { ok: true };
  } catch (err) {
    console.error("[rate-limit]", err instanceof Error ? err.message : err);
    return { ok: true };
  }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
