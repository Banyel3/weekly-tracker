"use client";

import { useDraggable } from "@dnd-kit/core";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeftRight, StickyNote } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode, Ref } from "react";
import type { ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { todayYmd, ymdToDate, type WeekRange } from "@/lib/week";
import { colorVar } from "../ColorSwatches";
import type { CardData } from "./dnd";
import { PriorityDot } from "./PriorityPills";

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

type MetaProps = { task: TaskDto; project: ProjectDto | null; week: WeekRange };

function CardMeta({ task, project, week, action }: MetaProps & { action?: ReactNode }) {
  const done = task.status === "DONE";
  const due = task.dueDate && !done ? dueLabel(task.dueDate, week, todayYmd()) : null;
  const checked = task.checklist.filter((i) => i.done).length;
  const total = task.checklist.length;
  const urgent = task.priority === "URGENT" && !done;
  const rolled = task.rolloverCount >= 2;
  const lastWeek = task.rolledBackAt === week.start;
  if (!project && !due && !total && !urgent && !rolled && !lastWeek && !task.note && !action) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs leading-4 text-muted-foreground">
      {project && (
        <span className="inline-flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: colorVar(project.color) }} />
          {project.name}
        </span>
      )}
      {due && (
        <span className={cn("tabular-nums", due.urgent && "text-[color:var(--alert)]")}>{due.text}</span>
      )}
      {total > 0 && (
        <span className="tabular-nums">
          <span aria-hidden="true">
            {checked}/{total}
          </span>
          <span className="sr-only">
            {checked} of {total} checklist items done
          </span>
        </span>
      )}
      {urgent && <span className="text-[color:var(--alert)]">urgent</span>}
      {rolled && (
        <span title="rolled over">
          <span aria-hidden="true">↩ {task.rolloverCount}</span>
          <span className="sr-only">rolled over {task.rolloverCount} weeks</span>
        </span>
      )}
      {lastWeek && <span className="rounded-full border px-1.5">last week</span>}
      {task.note && (
        <span className="inline-flex">
          <StickyNote aria-hidden="true" className="size-3" />
          <span className="sr-only">has note</span>
        </span>
      )}
      {action}
    </div>
  );
}

const CARD =
  "flex flex-none flex-col gap-1 rounded-lg border bg-muted px-2.5 py-2 transition-[border-color] duration-150 ease-out motion-reduce:transition-none";

type Props = MetaProps & {
  ref?: Ref<HTMLElement>;
  /**
   * "held" while a pointer drag owns the card (the overlay moves, layout animation stays off);
   * "dropped" right after a pointer drop: the card fades in where it landed instead of travelling there.
   */
  settle?: "held" | "dropped";
  onOpen: (task: TaskDto) => void;
  onMove?: (task: TaskDto) => void;
};

export const titleSelector = (id: string) => `[data-card-title="${CSS.escape(id)}"]`;

export function TaskCard({ ref, task, project, week, settle, onOpen, onMove }: Props) {
  const pending = task.id.startsWith("tmp-");
  const data: CardData = { status: task.status, title: task.title };
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: task.id,
    data,
    disabled: pending,
  });

  const opacity = isDragging ? 0.4 : pending || task.status === "DONE" ? 0.6 : 1;
  const moves = settle === undefined;

  return (
    <motion.article
      ref={(el: HTMLElement | null) => {
        setNodeRef(el);
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      layout={moves ? "position" : false}
      layoutId={moves ? task.id : undefined}
      initial={settle === "dropped" ? { opacity: 0.4, y: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity, y: 0 }}
      exit={settle === "held" ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
      className={cn(
        CARD,
        "cursor-grab hover:border-[color:color-mix(in_oklch,var(--border),white_15%)]",
        pending && "cursor-default",
      )}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <PriorityDot priority={task.priority} className="mt-1.5" />
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          type="button"
          data-card-title={task.id}
          title={task.title}
          disabled={pending}
          onClick={() => onOpen(task)}
          className="line-clamp-2 min-w-0 flex-1 cursor-[inherit] rounded-sm text-left text-sm leading-5 font-medium [overflow-wrap:anywhere] outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
        >
          {task.title}
        </button>
      </div>
      <CardMeta
        task={task}
        project={project}
        week={week}
        action={
          onMove &&
          !pending && (
            <button
              type="button"
              aria-label={`Move “${task.title}”`}
              aria-haspopup="dialog"
              onClick={() => onMove(task)}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="-my-1 ml-auto grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:-my-2.5 pointer-coarse:size-11"
            >
              <ArrowLeftRight aria-hidden="true" className="size-4" />
            </button>
          )
        }
      />
    </motion.article>
  );
}

export function CardPreview({ task, project, week }: MetaProps) {
  return (
    <article className={cn(CARD, "cursor-grabbing border-primary", task.status === "DONE" && "opacity-60")}>
      <div className="flex items-start gap-2">
        <PriorityDot priority={task.priority} className="mt-1.5" />
        <div className="line-clamp-2 min-w-0 flex-1 text-sm leading-5 font-medium [overflow-wrap:anywhere]">
          {task.title}
        </div>
      </div>
      <CardMeta task={task} project={project} week={week} />
    </article>
  );
}
