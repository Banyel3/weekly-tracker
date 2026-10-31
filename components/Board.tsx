"use client";

import { useCallback, useEffect, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { TaskDto } from "@/lib/tasks";
import { formatWeekRange, type WeekRange } from "@/lib/week";
import { Column } from "./Column";
import { TaskDialog, type DialogState, type StatusOption } from "./TaskDialog";

type Status = TaskDto["status"];
type BoardData = { week: WeekRange; tasks: TaskDto[] };

const COLUMNS: StatusOption[] = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "THIS_WEEK", label: "This Week" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
];

export function Board() {
  const [data, setData] = useState<BoardData | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reload = useCallback(async () => {
    const res = await fetch("/api/board", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || !data) return;
    const task = data.tasks.find((t) => t.id === active.id);
    const status = over.id as Status;
    if (!task || task.status === status) return;
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await reload();
  }

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>Weekly Tracker</h1>
          {data && <p className="week-range">{formatWeekRange(data.week)}</p>}
        </div>
        <button type="button" className="primary" onClick={() => setDialog({ mode: "create" })}>
          + New task
        </button>
      </header>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="board">
          {COLUMNS.map(({ status, label }) => (
            <Column
              key={status}
              status={status}
              label={label}
              tasks={data?.tasks.filter((t) => t.status === status) ?? []}
              onOpen={(task) => setDialog({ mode: "edit", task })}
            />
          ))}
        </div>
      </DndContext>
      <TaskDialog
        state={dialog}
        statuses={COLUMNS}
        onClose={() => setDialog(null)}
        onSaved={async () => {
          setDialog(null);
          await reload();
        }}
      />
    </main>
  );
}
