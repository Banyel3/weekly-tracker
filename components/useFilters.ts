"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { TaskDto } from "@/lib/tasks";

export type Filter = { kind: "project"; id: string } | { kind: "day"; ymd: string } | { kind: "query"; q: string } | null;

export type FiltersState = {
  filter: Filter;
  setFilter: (next: Filter) => void;
  clear: () => void;
};

export const FiltersContext = createContext<FiltersState | null>(null);

export function useFiltersState(): FiltersState {
  const [filter, setFilter] = useState<Filter>(null);
  const clear = useCallback(() => setFilter(null), []);
  return useMemo(() => ({ filter, setFilter, clear }), [filter, clear]);
}

export function useFilters(): FiltersState {
  const value = useContext(FiltersContext);
  if (!value) throw new Error("useFilters must be used inside <BoardProvider>");
  return value;
}

export function matchesFilter(task: TaskDto, filter: Filter): boolean {
  if (!filter) return true;
  if (filter.kind === "project") return task.projectId === filter.id;
  if (filter.kind === "day") return task.dueDate === filter.ymd;
  const q = filter.q.trim().toLowerCase();
  if (!q) return true;
  return task.title.toLowerCase().includes(q) || (task.note ?? "").toLowerCase().includes(q);
}
