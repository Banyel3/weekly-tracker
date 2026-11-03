"use client";

import { useEffect, useState } from "react";

export type JsonState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

/** A change of `refresh` refetches in place; the last good data stays shown meanwhile. */
export function useJson<T>(url: string, refresh: unknown = null): JsonState<T> {
  const [state, setState] = useState<JsonState<T>>({ status: "loading" });
  useEffect(() => {
    let live = true;
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: T) => live && setState({ status: "ready", data }))
      .catch(() => live && setState({ status: "error" }));
    return () => {
      live = false;
    };
  }, [url, refresh]);
  return state;
}
