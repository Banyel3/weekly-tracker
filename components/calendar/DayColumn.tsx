// adapted from https://github.com/origin-space/event-calendar
"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { dayId, fmtYmd } from "./calendar";
import { EventChip } from "./EventChip";

type Props = {
  ymd: string;
  today: string;
  tasks: TaskDto[];
  selected: boolean;
  projectOf: (id: string | null) => ProjectDto | null;
  onToggleDay: (ymd: string) => void;
  onOpen: (task: TaskDto) => void;
};

export function DayColumn({ ymd, today, tasks, selected, projectOf, onToggleDay, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId(ymd), data: { ymd } });
  const isToday = ymd === today;
  const past = ymd < today;

  return (
    <div
      ref={setNodeRef}
      role="group"
      data-today={isToday || undefined}
      aria-label={fmtYmd(ymd, "EEEE, MMM d")}
      className={cn(
        "flex min-h-[150px] min-w-0 flex-col gap-1.5 border-t-2 border-r border-t-transparent border-r-border px-2 pt-2 pb-3 transition-colors duration-150 ease-out last:border-r-0 max-[899px]:snap-start",
        isToday && "bg-muted",
        selected && "border-t-primary",
        isOver && "bg-accent",
      )}
    >
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
      {tasks.map((task) => (
        <EventChip key={task.id} task={task} project={projectOf(task.projectId)} today={today} onOpen={onOpen} />
      ))}
    </div>
  );
}
