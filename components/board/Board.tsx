"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { useBoardContext } from "../BoardProvider";
import type { NewTask } from "../useBoard";
import { useDebounced } from "../useDebounced";
import { useTaskDialog } from "../useTaskDialog";
import { matchesFilter, useFilters } from "../useFilters";
import { Column } from "./Column";
import { COLUMNS, KEYBOARD_CODES, SCREEN_READER_INSTRUCTIONS, announcements, columnCoordinates, type Status } from "./dnd";
import { SearchField } from "./SearchField";
import { CardPreview } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { UndoLine } from "./UndoLine";

const ERROR_TEXT = { load: "couldn't load the board", save: "couldn't save" };
const SEARCH_ID = "board-search";

function useBoardSearch() {
  const { filter, setFilter } = useFilters();
  const [q, setQ] = useState(filter?.kind === "query" ? filter.q : "");
  const settled = useDebounced(q, SEARCH_DEBOUNCE_MS);
  const current = useRef(filter);
  current.current = filter;

  useEffect(() => {
    if (filter?.kind !== "query") setQ("");
  }, [filter]);

  useEffect(() => {
    const value = settled.trim();
    if (value) setFilter({ kind: "query", q: value });
    else if (current.current?.kind === "query") setFilter(null);
  }, [settled, setFilter]);

  return [q, setQ] as const;
}

export function Board() {
  const board = useBoardContext();
  const { filter } = useFilters();
  const [q, setQ] = useBoardSearch();
  const { week, projects, tasks } = board;
  const visible = useMemo(() => tasks.filter((t) => matchesFilter(t, filter)), [tasks, filter]);
  const { target: dialog, openTask, openCreate, close } = useTaskDialog();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates, keyboardCodes: KEYBOARD_CODES }),
  );

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const projectOf = (projectId: string | null) => (projectId ? (projectsById.get(projectId) ?? null) : null);
  const active = tasks.find((t) => t.id === activeId) ?? null;

  async function onSubmit(body: NewTask): Promise<string | null> {
    if (!dialog || dialog.mode === "view") return null;
    if (dialog.mode === "create") {
      board.addTask(body);
      return null;
    }
    const { task } = dialog;
    const { status, ...rest } = body;
    return board.updateTask(task.id, status === task.status ? rest : body);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const task = tasks.find((t) => t.id === active.id);
    const to = over?.id as Status | undefined;
    if (task && to && task.status !== to) board.moveTask(task, to);
  }

  return (
    <section aria-labelledby="board-heading" className="flex min-h-[300px] flex-1 flex-col gap-3 max-[599px]:flex-none">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="board-heading" className="m-0 text-[13px] leading-5 font-semibold">
          Board
        </h2>
        <UndoLine returnFocusTo={SEARCH_ID} />
        <SearchField id={SEARCH_ID} value={q} onChange={setQ} className="ml-auto max-[599px]:w-full" />
        <Link
          href="/archive"
          className="rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          in archive
        </Link>
      </div>
      <div aria-live="polite" className="text-sm text-muted-foreground empty:hidden">
        {board.error && (
          <p className="m-0">
            {ERROR_TEXT[board.error]} ·{" "}
            <button
              type="button"
              onClick={board.retry}
              className="rounded-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              retry
            </button>
          </p>
        )}
      </div>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="min-h-0 flex-1 overflow-x-auto max-[599px]:overflow-visible">
          <div className="grid h-full min-w-[916px] grid-cols-[minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.8fr)] grid-rows-[minmax(0,1fr)] gap-3 max-[599px]:h-auto max-[599px]:min-w-0 max-[599px]:grid-cols-1 max-[599px]:grid-rows-none">
            {COLUMNS.map(({ status, label }) => (
              <Column
                key={status}
                status={status}
                label={label}
                week={week}
                tasks={visible.filter((t) => t.status === status)}
                total={tasks.filter((t) => t.status === status).length}
                projectOf={projectOf}
                loading={board.status === "loading"}
                onOpen={openTask}
                onAdd={openCreate}
              />
            ))}
          </div>
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
        onClose={close}
      />
    </section>
  );
}
