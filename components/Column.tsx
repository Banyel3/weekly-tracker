"use client";

import { useDroppable } from "@dnd-kit/core";
import type { TaskDto } from "@/lib/tasks";
import { TaskCard } from "./TaskCard";

type Props = {
  status: TaskDto["status"];
  label: string;
  tasks: TaskDto[];
  onOpen: (task: TaskDto) => void;
};

export function Column({ status, label, tasks, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section ref={setNodeRef} className={isOver ? "column is-over" : "column"}>
      <h2>
        {label} <span className="count">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="empty">No tasks</p>
      ) : (
        tasks.map((task) => <TaskCard key={task.id} task={task} onOpen={onOpen} />)
      )}
    </section>
  );
}
