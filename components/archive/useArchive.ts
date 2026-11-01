"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArchiveDto, ArchiveWeek } from "@/lib/archive";

export type ArchiveStatus = "loading" | "ready" | "error";

async function fetchPage(q: string, before: string | null): Promise<ArchiveDto | null> {
  const params = new URLSearchParams({ limit: "8" });
  if (q) params.set("q", q);
  if (before) params.set("before", before);
  const res = await fetch(`/api/archive?${params}`, { cache: "no-store" }).catch(() => null);
  return res?.ok ? res.json() : null;
}

export function useArchive(q: string) {
  const [weeks, setWeeks] = useState<ArchiveWeek[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [status, setStatus] = useState<ArchiveStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus("loading");
    fetchPage(q, null).then((data) => {
      if (!live) return;
      if (!data) return setStatus("error");
      setWeeks(data.weeks);
      setNextBefore(data.nextBefore);
      setStatus("ready");
    });
    return () => {
      live = false;
    };
  }, [q, attempt]);

  const older = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchPage(q, nextBefore);
    setLoadingMore(false);
    if (!data) return setStatus("error");
    setWeeks((ws) => [...ws, ...data.weeks]);
    setNextBefore(data.nextBefore);
  }, [q, nextBefore, loadingMore]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { weeks, nextBefore, status, loadingMore, older, retry };
}
