"use client";

import { useEffect, useState } from "react";
import { cachedState, fetchJson, type JsonState } from "./jsonCache";

export { invalidateJson, type JsonState } from "./jsonCache";

/**
 * A null url sends nothing. A cached url renders at once and is revalidated in the background.
 * A change of `refresh` refetches in place; the last good data stays shown meanwhile and after a failed refetch.
 */
export function useJson<T>(url: string | null, refresh: unknown = null): JsonState<T> {
  const [state, setState] = useState<JsonState<T>>(() => cachedState<T>(url));
  useEffect(() => {
    if (url === null) return;
    let live = true;
    const hit = cachedState<T>(url);
    if (hit.status === "ready") setState((s) => (s.status === "ready" && s.data === hit.data ? s : hit));
    fetchJson<T>(url)
      .then((data) => live && setState({ status: "ready", data }))
      .catch(() => live && setState((s) => (s.status === "ready" ? s : { status: "error" })));
    return () => {
      live = false;
    };
  }, [url, refresh]);
  return state;
}
