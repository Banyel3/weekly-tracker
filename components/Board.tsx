"use client";

import { useMemo, useState } from "react";
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
import { formatWeekRange } from "@/lib/week";
import { Column } from "./Column";
import { COLUMNS, KEYBOARD_CODES, SCREEN_READER_INSTRUCTIONS, announcements, columnCoordinates, type Status } from "./dnd";
import { CardPreview } from "./TaskCard";
import { TaskDialog, type DialogTarget } from "./TaskDialog";
import { useBoard, type NewTask } from "./useBoard";

const ERROR_TEXT = { load: "couldn't load the board", save: "couldn't save" };

export function Board() {
  const board = useBoard();
  const { week, projects, tasks } = board;
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates, keyboardCodes: KEYBOARD_CODES }),
  );

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const projectOf = (projectId: string | null) => (projectId ? (projectsById.get(projectId) ?? null) : null);
  const active = tasks.find((t) => t.id === activeId) ?? null;
  const rolledBack = week ? tasks.filter((t) => t.status === "BACKLOG" && t.rolledBackAt === week.start).length : 0;

  async function onSubmit(body: NewTask): Promise<string | null> {
    if (!dialog) return null;
    if (dialog.mode === "create") {
      board.addTask(body);
      return null;
    }
    const { task } = dialog;
    const { status, ...rest } = body;
    return board.updateTask(task.id, status === task.status ? rest : body);
  }

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
              projectOf={projectOf}
              loading={board.status === "loading"}
              onOpen={(task) => setDialog({ mode: "edit", task })}
              onAdd={(initialStatus) => setDialog({ mode: "create", initialStatus })}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active && week && <CardPreview task={active} project={projectOf(active.projectId)} week={week} />}
        </DragOverlay>
      </DndContext>
      <TaskDialog
        target={dialog}
        projects={projects}
        onCreateProject={(name, color) => board.addProject({ name, color })}
        onSubmit={onSubmit}
        onDelete={board.removeTask}
        onClose={() => setDialog(null)}
      />
    </main>
  );
}
