"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import type { WeekRange } from "@/lib/week";
import type { Status } from "./dnd";
import { TaskCard } from "./TaskCard";

type Props = {
  status: Status;
  label: string;
  week: WeekRange | null;
  tasks: TaskDto[];
  projectOf: (projectId: string | null) => ProjectDto | null;
  loading: boolean;
  onOpen: (task: TaskDto) => void;
  onAdd: (status: Status) => void;
};

export function Column({ status, label, week, tasks, projectOf, loading, onOpen, onAdd }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `column-${status}`;
  const className = ["column", `column-${status.toLowerCase().replace("_", "-")}`, isOver && "is-over"]
    .filter(Boolean)
    .join(" ");

  return (
    <section ref={setNodeRef} className={className} aria-labelledby={headingId} aria-busy={loading}>
      <div className="column-head">
        <h2 id={headingId}>{label}</h2>
        {week && <span className="count">{tasks.length}</span>}
      </div>
      <div className="column-list">
        {loading ? (
          <>
            <div className="placeholder" />
            <div className="placeholder" />
          </>
        ) : week && tasks.length === 0 ? (
          <p className="empty">nothing here</p>
        ) : (
          week &&
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} project={projectOf(task.projectId)} week={week} onOpen={onOpen} />
          ))
        )}
      </div>
      {week && (
        <button type="button" className="add-row" onClick={() => onAdd(status)}>
          + add
        </button>
      )}
    </section>
  );
}
