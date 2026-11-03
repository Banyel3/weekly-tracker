"use client";

import { useDraggable } from "@dnd-kit/core";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeftRight, CalendarDays, ListChecks, StickyNote, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode, Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Icon } from "@/components/ui/icon";
import type { ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { todayYmd, ymdToDate, type WeekRange } from "@/lib/week";
import { colorVar } from "../ColorSwatches";
import type { CardData } from "./dnd";
import { PriorityFlag } from "./PriorityFlag";

type Due = { text: string; urgent: boolean };

function format(ymd: string, pattern: string): string {
  return formatInTimeZone(ymdToDate(ymd), "UTC", pattern);
}

function dueLabel(dueDate: string, week: WeekRange, today: string): Due {
  if (dueDate === today) return { text: "today", urgent: true };
  if (dueDate < today) return { text: `overdue ${format(dueDate, "MMM d")}`, urgent: true };
  const inWeek = week.start <= dueDate && dueDate <= week.end;
  return { text: `due ${format(dueDate, inWeek ? "EEE" : "MMM d")}`, urgent: false };
}

/** Urgent open tasks also show the word "urgent" in the meta row. */
const urgentShown = (task: TaskDto) => task.priority === "URGENT" && task.status !== "DONE";

type MetaProps = { task: TaskDto; project: ProjectDto | null; week: WeekRange };

function CardMeta({ task, project, week, action }: MetaProps & { action?: ReactNode }) {
  const done = task.status === "DONE";
  const due = task.dueDate && !done ? dueLabel(task.dueDate, week, todayYmd()) : null;
  const checked = task.checklist.filter((i) => i.done).length;
  const total = task.checklist.length;
  const urgent = urgentShown(task);
  const rolled = task.rolloverCount >= 2;
  const lastWeek = task.rolledBackAt === week.start;
  if (!project && !due && !total && !urgent && !rolled && !lastWeek && !task.note && !action) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs leading-4 text-muted-foreground">
      {project && (
        <Badge variant="outline" className="max-w-full min-w-0 gap-1.5 px-2 py-0.5 font-normal text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: colorVar(project.color) }} />
          <span className="truncate">{project.name}</span>
        </Badge>
      )}
      {due && (
        <span className={cn("inline-flex items-center gap-1 tabular-nums", due.urgent && "text-[color:var(--alert)]")}>
          <Icon icon={CalendarDays} size="sm" />
          {due.text}
        </span>
      )}
      {total > 0 && (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Icon icon={ListChecks} size="sm" />
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
        <span title="rolled over" className="inline-flex items-center gap-1 tabular-nums">
          <Icon icon={Undo2} size="sm" />
          <span aria-hidden="true">{task.rolloverCount}</span>
          <span className="sr-only">rolled over {task.rolloverCount} weeks</span>
        </span>
      )}
      {lastWeek && (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground">
          last week
        </Badge>
      )}
      {task.note && (
        <span className="inline-flex">
          <Icon icon={StickyNote} size="sm" />
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
  /** Stable identity for shared-layout travel; defaults to the task id. */
  layoutKey?: string;
  onOpen: (task: TaskDto) => void;
  onMove?: (task: TaskDto) => void;
};

export const titleSelector = (id: string) => `[data-card-title="${CSS.escape(id)}"]`;

export function TaskCard({ ref, task, project, week, settle, layoutKey, onOpen, onMove }: Props) {
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
      layoutId={moves ? (layoutKey ?? task.id) : undefined}
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
        <PriorityFlag priority={task.priority} decorative={urgentShown(task)} className="mt-[3px]" />
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
            <Hint label="Move">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Move “${task.title}”`}
                aria-haspopup="dialog"
                onClick={() => onMove(task)}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="-my-1 ml-auto size-7 text-muted-foreground hover:text-foreground pointer-coarse:-my-2.5 pointer-coarse:size-11"
              >
                <Icon icon={ArrowLeftRight} />
              </Button>
            </Hint>
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
        <PriorityFlag priority={task.priority} decorative={urgentShown(task)} className="mt-[3px]" />
        <div className="line-clamp-2 min-w-0 flex-1 text-sm leading-5 font-medium [overflow-wrap:anywhere]">
          {task.title}
        </div>
      </div>
      <CardMeta task={task} project={project} week={week} />
    </article>
  );
}
