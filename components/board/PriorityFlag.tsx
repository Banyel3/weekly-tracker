import { Flag } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Priority = TaskDto["priority"];

export const PRIORITY_TONE: Record<Priority, string> = {
  NONE: "invisible",
  HIGH: "text-muted-foreground",
  URGENT: "text-[color:var(--alert)]",
};

type Props = {
  priority: Priority;
  className?: string;
  /** Render nothing for none instead of an invisible placeholder that keeps titles aligned. */
  omitWhenNone?: boolean;
  /** The priority is already said in visible text nearby, so the flag is decoration only. */
  decorative?: boolean;
};

export function PriorityFlag({ priority, className, omitWhenNone, decorative }: Props) {
  if (priority === "NONE" && omitWhenNone) return null;
  const silent = priority === "NONE" || decorative;
  return (
    <span aria-hidden={silent || undefined} className={cn("inline-flex", PRIORITY_TONE[priority], className)}>
      <Icon icon={Flag} size="sm" />
      {!silent && <span className="sr-only">{priority.toLowerCase()} priority</span>}
    </span>
  );
}
