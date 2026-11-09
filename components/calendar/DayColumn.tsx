// adapted from https://github.com/origin-space/event-calendar
"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { addLabel, dayId, fmtYmd, isEmptySpot } from "./calendar";
import { EventChip } from "./EventChip";

type Props = {
  ymd: string;
  today: string;
  tasks: TaskDto[];
  selected: boolean;
  /** An empty week shows only the date row. */
  collapsed?: boolean;
  projectOf: (id: string | null) => ProjectDto | null;
  onToggleDay: (ymd: string) => void;
  onOpen: (task: TaskDto) => void;
  onAdd: (ymd: string) => void;
};

/** Shown on hover or focus for a mouse, always on touch; the day's free space does the same on click. */
export function AddDayButton({ ymd, onAdd }: { ymd: string; onAdd: (ymd: string) => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={addLabel(ymd)}
      onClick={() => onAdd(ymd)}
      className="ml-auto flex-none text-muted-foreground opacity-0 group-hover/day:opacity-100 hover:text-foreground focus-visible:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100"
    >
      <Icon icon={Plus} size="sm" />
    </Button>
  );
}

export function DayColumn({ ymd, today, tasks, selected, collapsed, projectOf, onToggleDay, onOpen, onAdd }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId(ymd), data: { ymd } });
  const isToday = ymd === today;
  const past = ymd < today;

  return (
    <div
      ref={setNodeRef}
      role="group"
      data-today={isToday || undefined}
      aria-label={fmtYmd(ymd, "EEEE, MMM d")}
      onClick={(e) => isEmptySpot(e.target) && onAdd(ymd)}
      className={cn(
        "group/day flex min-w-0 flex-col gap-1.5 border-t-2 border-r border-t-transparent border-r-border px-2 pt-2 transition-colors duration-150 ease-out last:border-r-0 max-[899px]:snap-start",
        collapsed ? "min-h-14 pb-2" : "min-h-[150px] pb-3",
        isToday && "bg-muted",
        selected && "border-t-primary",
        isOver && "bg-accent",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${fmtYmd(ymd, "EEEE, MMM d")}${isToday ? ", today" : ""}: ${tasks.length} due. Show only this day on the board`}
          onClick={() => onToggleDay(ymd)}
          className={cn(
            "flex items-baseline gap-1.5 self-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:items-center",
            past && !isToday ? "text-muted-foreground" : "text-foreground",
          )}
        >
          <span className="text-xs font-medium text-muted-foreground">{fmtYmd(ymd, "EEE")}</span>
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              isToday && "rounded-full bg-primary px-1.5 text-primary-foreground",
            )}
          >
            {fmtYmd(ymd, "d")}
          </span>
        </button>
        <AddDayButton ymd={ymd} onAdd={onAdd} />
      </div>
      {tasks.map((task) => (
        <EventChip key={task.id} task={task} project={projectOf(task.projectId)} today={today} onOpen={onOpen} />
      ))}
    </div>
  );
}
