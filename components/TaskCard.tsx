"use client";

import { useDraggable } from "@dnd-kit/core";
import { formatInTimeZone } from "date-fns-tz";
import type { TaskDto } from "@/lib/tasks";
import { todayYmd, ymdToDate, type WeekRange } from "@/lib/week";
import type { CardData } from "./dnd";

type Due = { text: string; urgent: boolean };

function format(ymd: string, pattern: string): string {
  return formatInTimeZone(ymdToDate(ymd), "UTC", pattern);
}

function dueLabel(dueDate: string, week: WeekRange, today: string): Due {
  if (dueDate === today) return { text: "today", urgent: true };
  if (dueDate < today) return { text: `overdue · ${format(dueDate, "MMM d")}`, urgent: true };
  const inWeek = week.start <= dueDate && dueDate <= week.end;
  return { text: `due ${format(dueDate, inWeek ? "EEE" : "MMM d")}`, urgent: false };
}

function CardMeta({ task, week }: { task: TaskDto; week: WeekRange }) {
  const rolledBack = task.status === "BACKLOG" && task.rolledBackAt === week.start;
  const due = task.dueDate && task.status !== "DONE" ? dueLabel(task.dueDate, week, todayYmd()) : null;
  if (!rolledBack && !due && !task.note) return null;
  return (
    <div className="card-meta">
      {rolledBack && <span className="card-tag">last week</span>}
      {due && <span className={due.urgent ? "card-due is-urgent" : "card-due"}>{due.text}</span>}
      {task.note && (
        <span className="card-note" role="img" aria-label="has note">
          ·
        </span>
      )}
    </div>
  );
}

function cardClass(task: TaskDto, extra: string | false): string {
  return ["card", task.status === "DONE" && "is-done", extra].filter(Boolean).join(" ");
}

type Props = { task: TaskDto; week: WeekRange; onOpen: (task: TaskDto) => void };

export function TaskCard({ task, week, onOpen }: Props) {
  const pending = task.id.startsWith("tmp-");
  const data: CardData = { status: task.status, title: task.title };
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: task.id,
    data,
    disabled: pending,
  });

  return (
    <article
      ref={setNodeRef}
      className={cardClass(task, (isDragging && "is-source") || (pending && "is-pending"))}
      {...listeners}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        type="button"
        className="card-title"
        title={task.title}
        disabled={pending}
        onClick={() => onOpen(task)}
      >
        {task.title}
      </button>
      <CardMeta task={task} week={week} />
    </article>
  );
}

export function CardPreview({ task, week }: { task: TaskDto; week: WeekRange }) {
  return (
    <article className={cardClass(task, "is-dragging")}>
      <div className="card-title">{task.title}</div>
      <CardMeta task={task} week={week} />
    </article>
  );
}
