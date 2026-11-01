"use client";

import { useId } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { RadioGroup } from "@/components/ui/radio-group";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Priority = TaskDto["priority"];

const OPTIONS: { value: Priority; label: string }[] = [
  { value: "NONE", label: "none" },
  { value: "HIGH", label: "high" },
  { value: "URGENT", label: "urgent" },
];

const DOT: Record<Priority, string> = {
  NONE: "invisible",
  HIGH: "bg-muted-foreground",
  URGENT: "bg-[color:var(--alert)]",
};

/** Hidden for none so titles stay aligned; the sr text carries the priority where the meta row does not. */
export function PriorityDot({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span aria-hidden={priority === "NONE"} className={cn("size-2 shrink-0 rounded-full", DOT[priority], className)}>
      {priority !== "NONE" && <span className="sr-only">{priority.toLowerCase()} priority</span>}
    </span>
  );
}

type Props = { value: Priority; onChange: (value: Priority) => void; disabled?: boolean };

export function PriorityPills({ value, onChange, disabled }: Props) {
  const legend = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={legend} className="text-xs font-semibold text-muted-foreground">
        Priority
      </span>
      <RadioGroup
        aria-labelledby={legend}
        value={value}
        onValueChange={(v) => onChange(v as Priority)}
        disabled={disabled}
        orientation="horizontal"
        className="flex flex-wrap gap-1.5"
      >
        {OPTIONS.map((o) => (
          <RadioGroupPrimitive.Item
            key={o.value}
            value={o.value}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-150 ease-out outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-foreground data-[state=checked]:bg-muted motion-reduce:transition-none pointer-coarse:min-h-11"
          >
            {o.value !== "NONE" && <span aria-hidden="true" className={cn("size-2 rounded-full", DOT[o.value])} />}
            {o.label}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroup>
    </div>
  );
}
