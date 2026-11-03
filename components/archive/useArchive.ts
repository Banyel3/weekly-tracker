"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArchiveDto } from "@/lib/archive";
import { useBoardContext } from "../BoardProvider";
import { appendPage, archiveCache, dropTask, mergeFirstPage } from "./archiveCache";
import { createRequestToken } from "./requestToken";

export type ArchiveStatus = "loading" | "ready" | "error";

const EMPTY: ArchiveDto = { weeks: [], nextBefore: null };

async function fetchPage(q: string, before: string | null): Promise<ArchiveDto | null> {
  const params = new URLSearchParams({ limit: "8" });
  if (q) params.set("q", q);
  if (before) params.set("before", before);
  const res = await fetch(`/api/archive?${params}`, { cache: "no-store" }).catch(() => null);
  return res?.ok ? res.json() : null;
}

/** A cached query renders at once and its first page is revalidated in the background. */
export function useArchive(q: string) {
  const { version } = useBoardContext();
  const [page, setPage] = useState<ArchiveDto>(() => archiveCache.get(q) ?? EMPTY);
  const [status, setStatus] = useState<ArchiveStatus>(() => (archiveCache.get(q) ? "ready" : "loading"));
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stale, setStale] = useState(0);
  const [first] = useState(createRequestToken);
  const [more] = useState(createRequestToken);
  const seenVersion = useRef(version);

  const show = useCallback((key: string, data: ArchiveDto) => {
    archiveCache.set(key, data);
    setPage(data);
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (seenVersion.current === version) return;
    seenVersion.current = version;
    const current = archiveCache.get(q);
    archiveCache.invalidate();
    if (!current) return;
    archiveCache.set(q, current);
    setStale((n) => n + 1);
  }, [version, q]);

  useEffect(() => {
    more.next();
    setLoadingMore(false);
    setMoreFailed(false);
  }, [q, attempt, more]);

  useEffect(() => {
    const cached = archiveCache.get(q);
    if (cached) {
      setPage(cached);
      setStatus("ready");
    } else setStatus("loading");
    const token = first.next();
    fetchPage(q, null).then((data) => {
      if (!first.isCurrent(token)) return;
      if (data) show(q, mergeFirstPage(data, archiveCache.get(q)));
      else if (!archiveCache.get(q)) setStatus("error");
    });
  }, [q, attempt, stale, first, show]);

  const older = useCallback(async () => {
    if (!page.nextBefore || loadingMore) return;
    const token = more.next();
    setLoadingMore(true);
    setMoreFailed(false);
    const data = await fetchPage(q, page.nextBefore);
    if (!more.isCurrent(token)) return;
    setLoadingMore(false);
    if (!data) return setMoreFailed(true);
    show(q, appendPage(archiveCache.get(q) ?? page, data));
  }, [q, page, loadingMore, more, show]);

  const drop = useCallback((id: string) => {
    archiveCache.update((data) => dropTask(data, id));
    setPage((p) => dropTask(p, id));
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { weeks: page.weeks, nextBefore: page.nextBefore, status, loadingMore, moreFailed, older, drop, retry };
}
