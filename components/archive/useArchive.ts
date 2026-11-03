"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArchiveDto, ArchiveWeek } from "@/lib/archive";
import { createRequestToken } from "./requestToken";

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
  const [moreFailed, setMoreFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tokens] = useState(createRequestToken);

  useEffect(() => {
    const token = tokens.next();
    setStatus("loading");
    setLoadingMore(false);
    setMoreFailed(false);
    fetchPage(q, null).then((data) => {
      if (!tokens.isCurrent(token)) return;
      if (!data) return setStatus("error");
      setWeeks(data.weeks);
      setNextBefore(data.nextBefore);
      setStatus("ready");
    });
  }, [q, attempt, tokens]);

  const older = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    const token = tokens.next();
    setLoadingMore(true);
    setMoreFailed(false);
    const data = await fetchPage(q, nextBefore);
    if (!tokens.isCurrent(token)) return;
    setLoadingMore(false);
    if (!data) return setMoreFailed(true);
    setWeeks((ws) => [...ws, ...data.weeks]);
    setNextBefore(data.nextBefore);
  }, [q, nextBefore, loadingMore, tokens]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { weeks, nextBefore, status, loadingMore, moreFailed, older, retry };
}
