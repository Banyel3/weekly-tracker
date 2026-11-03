/** In-memory, per-tab cache: survives client navigation, gone on reload. */
export function createRouteCache<T>() {
  const entries = new Map<string, { data: T; at: number }>();
  return {
    get: (key: string): T | undefined => entries.get(key)?.data,
    set: (key: string, data: T) => void entries.set(key, { data, at: Date.now() }),
    update: (fn: (data: T) => T) => {
      for (const [key, entry] of entries) entries.set(key, { data: fn(entry.data), at: entry.at });
    },
    invalidate: (prefix = "") => {
      for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
    },
  };
}
