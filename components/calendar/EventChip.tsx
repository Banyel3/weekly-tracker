// adapted from https://github.com/origin-space/event-calendar
"use client";

import { useDraggable } from "@dnd-kit/core";
import type { ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { TASK_PREFIX, chipStyle, isOverdue } from "./calendar";
import { moveChipFocus, type ChipData } from "./dnd";

const CHIP =
  "block w-full truncate rounded-md px-2 py-0.5 text-left text-[11px] leading-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11";

type Props = {
  task: TaskDto;
  project: ProjectDto | null;
  today: string;
  onOpen: (task: TaskDto) => void;
};

function ChipText({ task, project, today }: Omit<Props, "onOpen">) {
  const done = task.status === "DONE";
  return (
    <>
      {task.title}
      <span className="sr-only">
        {project ? `, ${project.name}` : ""}
        {done ? ", done" : isOverdue(task, today) ? ", overdue" : ""}
      </span>
    </>
  );
}

function tone(task: TaskDto, project: ProjectDto | null, today: string) {
  const done = task.status === "DONE";
  return {
    className: cn(CHIP, done && "line-through opacity-55"),
    style: chipStyle({ color: project?.color ?? null, done, overdue: isOverdue(task, today) }),
  };
}

export function EventChip({ task, project, today, onOpen }: Props) {
  const data: ChipData = { taskId: task.id, title: task.title, dueDate: task.dueDate ?? "" };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `${TASK_PREFIX}${task.id}`,
    data,
    disabled: task.id.startsWith("tmp-"),
  });
  const { className, style } = tone(task, project, today);

  return (
    <button
      ref={setNodeRef}
      type="button"
      title={task.title}
      data-cal-chip
      data-day={task.dueDate}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable task"
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (!isDragging && !event.defaultPrevented) moveChipFocus(event);
      }}
      onClick={() => !isDragging && onOpen(task)}
      className={cn(className, "cursor-grab", isDragging && "opacity-40")}
      style={style}
    >
      <ChipText task={task} project={project} today={today} />
    </button>
  );
}

export function StaticChip({ task, project, today, onOpen }: Props) {
  const { className, style } = tone(task, project, today);
  return (
    <button
      type="button"
      title={task.title}
      data-cal-chip
      data-day={task.dueDate}
      onKeyDown={moveChipFocus}
      onClick={() => onOpen(task)}
      className={className}
      style={style}
    >
      <ChipText task={task} project={project} today={today} />
    </button>
  );
}

export function ChipPreview({ task, project, today }: Omit<Props, "onOpen">) {
  const { className, style } = tone(task, project, today);
  return (
    <div className={cn(className, "cursor-grabbing bg-card ring-1 ring-primary")} style={style}>
      {task.title}
    </div>
  );
}
