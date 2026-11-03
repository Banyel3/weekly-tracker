import type { ArchiveDto } from "@/lib/archive";
import { createRouteCache } from "../routeCache";

/** Loaded weeks and cursor per search query, so returning to /archive restores the list. */
export const archiveCache = createRouteCache<ArchiveDto>();

/** Keeps the pages loaded with "older" beyond a fresh first page, so revalidating does not shorten the list. */
export function mergeFirstPage(first: ArchiveDto, cached: ArchiveDto | undefined): ArchiveDto {
  const cut = first.nextBefore;
  if (!cached || cut === null) return first;
  const tail = cached.weeks.filter((w) => w.start < cut);
  return tail.length > 0 ? { weeks: [...first.weeks, ...tail], nextBefore: cached.nextBefore } : first;
}

export function appendPage(base: ArchiveDto, next: ArchiveDto): ArchiveDto {
  const seen = new Set(base.weeks.map((w) => w.start));
  return { weeks: [...base.weeks, ...next.weeks.filter((w) => !seen.has(w.start))], nextBefore: next.nextBefore };
}

export function dropTask(page: ArchiveDto, id: string): ArchiveDto {
  return { ...page, weeks: page.weeks.map((w) => ({ ...w, tasks: w.tasks.filter((t) => t.id !== id) })) };
}

/** A subscribable id set kept at module level, so it outlives the component that changed it. */
export function createIdSet() {
  let ids: ReadonlySet<string> = new Set();
  const listeners = new Set<() => void>();
  return {
    get: () => ids,
    set(id: string, on: boolean) {
      if (ids.has(id) === on) return;
      const next = new Set(ids);
      if (on) next.add(id);
      else next.delete(id);
      ids = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** Rows deleted from /archive: hidden while the 5 s undo window runs, even after leaving and returning. */
export const hiddenArchiveRows = createIdSet();
