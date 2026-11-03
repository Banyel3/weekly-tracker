"use client";

import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { ymdToDate } from "@/lib/week";
import { useBoardContext } from "../BoardProvider";
import { useFilters, type Filter } from "../useFilters";

function labelOf(filter: NonNullable<Filter>, projectName: (id: string) => string): string {
  if (filter.kind === "project") return `Project: ${projectName(filter.id)}`;
  if (filter.kind === "day") return `Due ${formatInTimeZone(ymdToDate(filter.ymd), "UTC", "EEE MMM d")}`;
  return `Search: “${filter.q}”`;
}

export function FilterChip({ className }: { className?: string }) {
  const { filter, clear } = useFilters();
  const { projects } = useBoardContext();
  if (!filter) return null;
  const label = labelOf(filter, (id) => projects.find((p) => p.id === id)?.name ?? "project");
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-full border border-[color:color-mix(in_oklch,var(--border),white_12%)] px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={clear}
        aria-label={`clear filter ${label}`}
        className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:px-2"
      >
        clear
      </button>
    </span>
  );
}
