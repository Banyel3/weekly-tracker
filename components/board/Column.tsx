"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Icon } from "@/components/ui/icon";
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
  onMove?: (task: TaskDto) => void;
  settleOf?: (task: TaskDto) => "held" | "dropped" | undefined;
  keyOf?: (task: TaskDto) => string;
  className?: string;
};

export function Column({ status, label, week, tasks, total, projectOf, loading, onOpen, onAdd, onMove, settleOf, keyOf, className }: Props) {
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
      <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-2">
        <h2 id={headingId} className="m-0">
          <Badge variant="outline" className="gap-1.5 px-2 py-0.5 text-xs font-medium">
            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: statusVar(status) }} />
            {label}
          </Badge>
        </h2>
        {week && (
          <span className={cn("text-xs tabular-nums", overLimit ? "text-[color:var(--alert)]" : "text-muted-foreground")}>
            {overLimit ? `${total} / ${WIP_LIMIT}` : tasks.length}
            {overLimit && <span className="sr-only">, over the limit of {WIP_LIMIT}</span>}
          </span>
        )}
        {week && (
          <Hint label="Add task">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Add task"
              aria-describedby={headingId}
              onClick={() => onAdd(status)}
              className="ml-auto size-7 text-muted-foreground hover:text-foreground pointer-coarse:size-11"
            >
              <Icon icon={Plus} />
            </Button>
          </Hint>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-1">
        {loading ? (
          <>
            <div className="h-12 flex-none animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
            <div className="h-12 flex-none animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
          </>
        ) : (
          week && (
            <>
              {tasks.length === 0 && <p className="m-0 px-0.5 py-1 text-xs text-muted-foreground">nothing here</p>}
              <AnimatePresence mode="popLayout" initial={false}>
                {tasks.map((task) => (
                  <TaskCard
                    key={keyOf?.(task) ?? task.id}
                    layoutKey={keyOf?.(task)}
                    task={task}
                    project={projectOf(task.projectId)}
                    week={week}
                    settle={settleOf?.(task)}
                    onOpen={onOpen}
                    onMove={onMove}
                  />
                ))}
              </AnimatePresence>
            </>
          )
        )}
      </div>
      {week && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAdd(status)}
          className="mx-2 mb-2 flex-none self-start text-muted-foreground hover:text-foreground pointer-coarse:h-11"
        >
          <Icon icon={Plus} size="sm" />
          Add
        </Button>
      )}
    </section>
  );
}
