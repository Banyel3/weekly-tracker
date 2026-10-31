"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatInTimeZone } from "date-fns-tz";
import type { TaskDto } from "@/lib/tasks";
import { todayYmd, ymdToDate } from "@/lib/week";

type Props = { task: TaskDto; onOpen: (task: TaskDto) => void };

export function TaskCard({ task, onOpen }: Props) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id: task.id });
  const overdue = task.dueDate !== null && task.dueDate < todayYmd() && task.status !== "DONE";
  const className = ["card", overdue && "overdue", isDragging && "dragging"].filter(Boolean).join(" ");

  return (
    <article
      ref={setNodeRef}
      className={className}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={() => onOpen(task)}
      {...listeners}
      {...attributes}
    >
      <div className="card-title">{task.title}</div>
      {task.dueDate && (
        <div className="card-due">Due {formatInTimeZone(ymdToDate(task.dueDate), "UTC", "MMM d")}</div>
      )}
      {task.note && <div className="card-note">{task.note}</div>}
    </article>
  );
}
