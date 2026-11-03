"use client";

import { formatInTimeZone } from "date-fns-tz";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Icon } from "@/components/ui/icon";
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
    <Badge variant="outline" className={cn("max-w-full min-w-0 gap-1 py-0 pr-0.5 pl-2 text-xs font-normal", className)}>
      <span className="truncate">{label}</span>
      <Hint label="Clear filter">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={clear}
          aria-label={`clear filter ${label}`}
          className="size-5 rounded-full text-muted-foreground hover:text-foreground pointer-coarse:size-11"
        >
          <Icon icon={X} size="sm" />
        </Button>
      </Hint>
    </Badge>
  );
}
