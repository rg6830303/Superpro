/**
 * A tiny per-instance cache for public, read-only queries.
 *
 * Under a traffic spike every visitor asks for the same home-page data
 * (products, this week's slots, tournaments, coaches). Without this, each
 * request runs the same handful of queries through a pool of five, and the
 * pool, not the page, becomes the bottleneck. Here a value is reused for a few
 * seconds, and concurrent misses share one in-flight query instead of
 * stampeding the database.
 *
 * Values are returned as-is (no serialisation), so Dates and other objects
 * survive. Failures are not cached.
 */
type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_KEYS = 500;

export function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value as T);
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = load()
    .then((value) => {
      if (store.size >= MAX_KEYS) store.delete(store.keys().next().value as string);
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Drop cached entries whose key starts with `prefix` (after an admin edit). */
export function forget(prefix = ""): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
