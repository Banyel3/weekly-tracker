"use client";

import { useId } from "react";
import { Flag } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Priority = TaskDto["priority"];

const OPTIONS: { value: Priority; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const TONE: Record<Priority, string> = {
  NONE: "invisible",
  HIGH: "text-muted-foreground",
  URGENT: "text-[color:var(--alert)]",
};

/** Hidden for none so titles stay aligned; the sr text carries the priority where the meta row does not. */
export function PriorityFlag({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span aria-hidden={priority === "NONE"} className={cn("inline-flex", TONE[priority], className)}>
      <Icon icon={Flag} size="sm" />
      {priority !== "NONE" && <span className="sr-only">{priority.toLowerCase()} priority</span>}
    </span>
  );
}

type Props = { value: Priority; onChange: (value: Priority) => void; disabled?: boolean };

export function PriorityPills({ value, onChange, disabled }: Props) {
  const legend = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={legend} className="text-xs font-medium text-muted-foreground">
        Priority
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={legend}
        value={value}
        onValueChange={(v) => v && onChange(v as Priority)}
        disabled={disabled}
        className="w-full bg-background"
      >
        {OPTIONS.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            className="flex-1 gap-1.5 text-sm data-[state=on]:bg-accent data-[state=on]:text-accent-foreground pointer-coarse:h-11"
          >
            {o.value !== "NONE" && <Icon icon={Flag} size="sm" className={TONE[o.value]} />}
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
