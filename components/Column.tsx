"use client";

import { useDroppable } from "@dnd-kit/core";
import type { TaskDto } from "@/lib/tasks";
import type { WeekRange } from "@/lib/week";
import type { Status } from "./dnd";
import { QuickAdd } from "./QuickAdd";
import { TaskCard } from "./TaskCard";

type Props = {
  status: Status;
  label: string;
  week: WeekRange | null;
  tasks: TaskDto[];
  loading: boolean;
  onOpen: (task: TaskDto) => void;
  onAdd: (title: string, status: Status) => void;
};

export function Column({ status, label, week, tasks, loading, onOpen, onAdd }: Props) {
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
          week && tasks.map((task) => <TaskCard key={task.id} task={task} week={week} onOpen={onOpen} />)
        )}
      </div>
      {week && <QuickAdd onAdd={(title) => onAdd(title, status)} />}
    </section>
  );
}
