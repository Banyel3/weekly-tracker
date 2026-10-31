"use client";

import { useEffect, useState } from "react";

export type JsonState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

export function useJson<T>(url: string): JsonState<T> {
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
  }, [url]);
  return state;
}
