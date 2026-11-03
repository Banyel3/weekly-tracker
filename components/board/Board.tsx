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
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { LayoutGroup } from "motion/react";
import { Button } from "@/components/ui/button";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { useBoardContext } from "../BoardProvider";
import { STILL_PX, isLongPressWithoutMove } from "../gestures";
import { DURATION_MS, EASE_OUT_CSS, useReducedMotion } from "../motion/config";
import type { NewTask } from "../useBoard";
import { useDebounced } from "../useDebounced";
import { haptic } from "../haptics";
import { useIsPhone } from "../useMediaQuery";
import { useTaskDialog } from "../useTaskDialog";
import { matchesFilter, useFilters } from "../useFilters";
import { Column } from "./Column";
import { MobileBoard } from "./MobileBoard";
import { MoveSheet } from "./MoveSheet";
import { COLUMNS, KEYBOARD_CODES, SCREEN_READER_INSTRUCTIONS, announcements, columnCoordinates, type Status } from "./dnd";
import { SearchField } from "./SearchField";
import { CardPreview, titleSelector } from "./TaskCard";
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

// No side effects: dnd-kit would restore a stale inline opacity on the source card after motion has animated it.
const DROP: DropAnimation = { duration: DURATION_MS, easing: EASE_OUT_CSS, sideEffects: null };

const isTouch = (event: Event) => typeof TouchEvent !== "undefined" && event instanceof TouchEvent;
const isKeyboard = (event: Event) => typeof KeyboardEvent !== "undefined" && event instanceof KeyboardEvent;

/** The card's title button, skipping a copy that is still animating out (popped by AnimatePresence). */
function liveTitle(id: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(titleSelector(id))].find((el) => !el.closest("[data-motion-pop-id]"));
}

type Drag = { id: string; pointer: boolean; armed: boolean };

/** Pointer drags hand the card to the overlay; a successful pointer drop fades in at the destination for one beat. */
function useDragState() {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!dropped) return;
    const timer = setTimeout(() => setDropped(null), DURATION_MS * 2);
    return () => clearTimeout(timer);
  }, [dropped]);
  return { drag, setDrag, dropped, setDropped, landed, setLanded };
}

export function Board() {
  const board = useBoardContext();
  const { filter } = useFilters();
  const [q, setQ] = useBoardSearch();
  const { week, projects, tasks } = board;
  const visible = useMemo(() => tasks.filter((t) => matchesFilter(t, filter)), [tasks, filter]);
  const { target: dialog, openTask, openCreate, close } = useTaskDialog();
  const { drag, setDrag, dropped, setDropped, landed, setLanded } = useDragState();
  const activeId = drag?.id ?? null;
  const phone = useIsPhone();
  const reduced = useReducedMotion();
  const [moving, setMoving] = useState<TaskDto | null>(null);
  const refocus = useRef<string | null>(null);
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

  function onDragStart({ active, activatorEvent }: DragStartEvent) {
    if (phone) haptic();
    setDropped(null);
    setLanded(false);
    setDrag({ id: String(active.id), pointer: !isKeyboard(activatorEvent), armed: false });
  }

  // Autoscroll stays off until the finger has moved, so a still long-press near an edge never pages the carousel.
  function onDragMove({ delta }: DragMoveEvent) {
    if (drag && !drag.armed && Math.hypot(delta.x, delta.y) >= STILL_PX) setDrag({ ...drag, armed: true });
  }

  function onDragEnd({ active, over, delta, activatorEvent }: DragEndEvent) {
    const task = tasks.find((t) => t.id === active.id);
    const to = over?.id as Status | undefined;
    const moved = !!task && !!to && task.status !== to;
    setLanded(moved);
    setDrag(null);
    if (task && phone && isLongPressWithoutMove({ touch: isTouch(activatorEvent), delta, over: to, from: task.status })) {
      openMove(task, true);
      return;
    }
    if (task && to && moved) {
      if (phone) haptic();
      if (drag?.pointer) setDropped(task.id);
      board.moveTask(task, to);
    }
  }

  function openMove(task: TaskDto, byPress: boolean) {
    refocus.current = byPress ? task.id : null;
    setMoving(task);
  }

  function settleOf(task: TaskDto): "held" | "dropped" | undefined {
    if (drag?.pointer && drag.id === task.id) return "held";
    return dropped === task.id ? "dropped" : undefined;
  }

  function renderColumn(status: Status, label: string, className?: string) {
    return (
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
        onMove={phone ? (task) => openMove(task, false) : undefined}
        settleOf={settleOf}
        keyOf={board.keyOf}
        className={className}
      />
    );
  }

  return (
    <section aria-labelledby="board-heading" className="flex min-h-[300px] flex-1 flex-col gap-3 max-[899px]:min-h-[60dvh] max-[899px]:flex-none">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="board-heading" className={cn("m-0 text-sm leading-5 font-medium", phone && "sr-only")}>
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
            <Button variant="link" size="inline" onClick={board.retry} className="text-foreground">
              retry
            </Button>
          </p>
        )}
      </div>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        autoScroll={phone ? { enabled: drag?.armed ?? false, threshold: { x: 0.15, y: 0 } } : undefined}
        onDragStart={onDragStart}
        onDragMove={phone ? onDragMove : undefined}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        {phone ? (
          <LayoutGroup id="board-phone">
            <MobileBoard
              dragging={activeId !== null}
              columns={COLUMNS.map(({ status }) => ({
                shown: visible.filter((t) => t.status === status).length,
                total: tasks.filter((t) => t.status === status).length,
              }))}
              renderColumn={(status, label) => renderColumn(status, label, "h-full")}
            />
          </LayoutGroup>
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto max-[899px]:invisible">
            <LayoutGroup id="board-desktop">
              <div className="grid h-full min-w-[916px] grid-cols-[minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.8fr)] grid-rows-[minmax(0,1fr)] gap-3">
                {COLUMNS.map(({ status, label }) => renderColumn(status, label))}
              </div>
            </LayoutGroup>
          </div>
        )}
        <DragOverlay dropAnimation={reduced || landed ? null : DROP}>
          {active && week && <CardPreview task={active} project={projectOf(active.projectId)} week={week} />}
        </DragOverlay>
      </DndContext>
      {phone && (
        <MoveSheet
          task={moving}
          onMove={(task, to) => {
            refocus.current = task.id;
            board.moveTask(task, to);
          }}
          onClose={() => setMoving(null)}
          onCloseAutoFocus={(e) => {
            const id = refocus.current;
            refocus.current = null;
            if (!id) return;
            e.preventDefault();
            requestAnimationFrame(() => liveTitle(id)?.focus({ preventScroll: true }));
          }}
        />
      )}
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
