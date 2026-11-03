"use client";

import { useEffect, useState } from "react";

export type JsonState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

/** A null url sends nothing. A change of `refresh` refetches in place; the last good data stays shown meanwhile and after a failed refetch. */
export function useJson<T>(url: string | null, refresh: unknown = null): JsonState<T> {
  const [state, setState] = useState<JsonState<T>>({ status: "loading" });
  useEffect(() => {
    if (url === null) return;
    let live = true;
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: T) => live && setState({ status: "ready", data }))
      .catch(() => live && setState((s) => (s.status === "ready" ? s : { status: "error" })));
    return () => {
      live = false;
    };
  }, [url, refresh]);
  return state;
}
