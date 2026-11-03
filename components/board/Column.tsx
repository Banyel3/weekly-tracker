"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { WIP_LIMIT } from "@/lib/constants";
import type { ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { WeekRange } from "@/lib/week";
import type { Status } from "./dnd";
import { TaskCard } from "./TaskCard";

export const statusVar = (status: Status) => `var(--status-${status.toLowerCase().replace("_", "-")})`;

type Props = {
  status: Status;
  label: string;
  week: WeekRange | null;
  tasks: TaskDto[];
  total: number;
  projectOf: (projectId: string | null) => ProjectDto | null;
  loading: boolean;
  onOpen: (task: TaskDto) => void;
  onAdd: (status: Status) => void;
  className?: string;
};

export function Column({ status, label, week, tasks, total, projectOf, loading, onOpen, onAdd, className }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `column-${status}`;
  const overLimit = status === "IN_PROGRESS" && total > WIP_LIMIT;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      aria-busy={loading}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card transition-colors duration-150 ease-out motion-reduce:transition-none",
        overLimit && "border-[color:var(--alert)]",
        isOver && "border-primary",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1.5">
        <h2 id={headingId} className="m-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted py-0.5 pr-2.5 pl-2 text-xs leading-4 font-semibold">
            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: statusVar(status) }} />
            {label}
          </span>
        </h2>
        {week && (
          <span className={cn("text-xs tabular-nums", overLimit ? "text-[color:var(--alert)]" : "text-muted-foreground")}>
            {overLimit ? `${total} / ${WIP_LIMIT}` : tasks.length}
            {overLimit && <span className="sr-only">, over the limit of {WIP_LIMIT}</span>}
          </span>
        )}
        {week && (
          <button
            type="button"
            aria-label="add task"
            aria-describedby={headingId}
            onClick={() => onAdd(status)}
            className="ml-auto grid size-6 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-1">
        {loading ? (
          <>
            <div className="h-12 flex-none animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
            <div className="h-12 flex-none animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
          </>
        ) : week && tasks.length === 0 ? (
          <p className="m-0 px-0.5 py-1 text-sm text-muted-foreground">nothing here</p>
        ) : (
          week &&
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} project={projectOf(task.projectId)} week={week} onOpen={onOpen} />
          ))
        )}
      </div>
      {week && (
        <button
          type="button"
          onClick={() => onAdd(status)}
          className="mx-2 mb-2 flex-none self-start rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
        >
          + add
        </button>
      )}
    </section>
  );
}
