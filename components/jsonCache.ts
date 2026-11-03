import { createRouteCache } from "./routeCache";

export type JsonState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

const cache = createRouteCache<unknown>();

export const invalidateJson = (prefix: string) => cache.invalidate(prefix);

/** A hit renders at once; the caller still revalidates in the background. */
export function cachedState<T>(url: string | null): JsonState<T> {
  const data = url === null ? undefined : cache.get(url);
  return data === undefined ? { status: "loading" } : { status: "ready", data: data as T };
}

/** Rejects on a network or HTTP failure and leaves any cached entry in place. */
export async function fetchJson<T>(url: string, load: typeof fetch = fetch): Promise<T> {
  const res = await load(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`request failed (${res.status})`);
  const data: T = await res.json();
  cache.set(url, data);
  return data;
}
