"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { TaskDto } from "@/lib/tasks";
import { formatWeekRange } from "@/lib/week";
import { Column } from "./Column";
import { COLUMNS, KEYBOARD_CODES, SCREEN_READER_INSTRUCTIONS, announcements, columnCoordinates, type Status } from "./dnd";
import { CardPreview } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { useBoard } from "./useBoard";

const ERROR_TEXT = { load: "couldn't load the board", save: "couldn't save" };

export function Board() {
  const board = useBoard();
  const { week, tasks } = board;
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates, keyboardCodes: KEYBOARD_CODES }),
  );

  const active = tasks.find((t) => t.id === activeId) ?? null;
  const rolledBack = week ? tasks.filter((t) => t.status === "BACKLOG" && t.rolledBackAt === week.start).length : 0;

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const task = tasks.find((t) => t.id === active.id);
    const to = over?.id as Status | undefined;
    if (task && to && task.status !== to) board.moveTask(task, to);
  }

  return (
    <main className="app">
      <header className="app-header">
        {week && <h1>{formatWeekRange(week)}</h1>}
        {rolledBack > 0 && <p className="rollover-line">{rolledBack} back from last week</p>}
      </header>
      <div className="status-line" aria-live="polite">
        {board.error && (
          <p>
            {ERROR_TEXT[board.error]} ·{" "}
            <button type="button" className="text-button" onClick={board.retry}>
              retry
            </button>
          </p>
        )}
      </div>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="board">
          {COLUMNS.map(({ status, label }) => (
            <Column
              key={status}
              status={status}
              label={label}
              week={week}
              tasks={tasks.filter((t) => t.status === status)}
              loading={board.status === "loading"}
              onOpen={setEditing}
              onAdd={board.addTask}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{active && week && <CardPreview task={active} week={week} />}</DragOverlay>
      </DndContext>
      <TaskDialog task={editing} onClose={() => setEditing(null)} onSave={board.updateTask} onDelete={board.removeTask} />
    </main>
  );
}
