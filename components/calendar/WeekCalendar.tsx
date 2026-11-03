"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayYmd, weekRange } from "@/lib/week";
import { useBoardContext } from "../BoardProvider";
import { FilterChip } from "../board/FilterChip";
import { useFilters } from "../useFilters";
import { useIsPhone } from "../useMediaQuery";
import { useTaskDialog } from "../useTaskDialog";
import { calendarTasks, fmtYmd, monthGrid, monthOf, shiftMonth, weekDays, ymdOfDayId, type Month } from "./calendar";
import { DayColumn } from "./DayColumn";
import { CAL_INSTRUCTIONS, CAL_KEYBOARD_CODES, calAnnouncements, dayCoordinates, type ChipData } from "./dnd";
import { ChipPreview } from "./EventChip";

type View = "week" | "month";

const MonthView = dynamic(() => import("./MonthView").then((m) => m.MonthView), { ssr: false });

const NAV =
  "grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11";
const TOGGLE =
  "h-7 px-2.5 text-xs font-normal text-muted-foreground data-[state=on]:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11";

export function WeekCalendar() {
  const board = useBoardContext();
  const { filter, setFilter } = useFilters();
  const { openTask } = useTaskDialog();
  const [view, setView] = useState<View>("week");
  const today = board.today ?? todayYmd();
  const week = board.week ?? weekRange();
  const [month, setMonth] = useState<Month>(() => monthOf(today));
  const [activeId, setActiveId] = useState<string | null>(null);
  const phone = useIsPhone();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledToToday = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: dayCoordinates, keyboardCodes: CAL_KEYBOARD_CODES }),
  );

  const days = view === "week" ? weekDays(week.start) : monthGrid(month);
  const [from, to] = [days[0], days[days.length - 1]];
  const visible = useMemo(() => calendarTasks(board.tasks, filter, from, to), [board.tasks, filter, from, to]);
  const tasksOn = (ymd: string) => visible.filter((t) => t.dueDate === ymd);
  const projectsById = useMemo(() => new Map(board.projects.map((p) => [p.id, p])), [board.projects]);
  const projectOf = (id: string | null) => (id ? (projectsById.get(id) ?? null) : null);
  const active = board.tasks.find((t) => t.id === activeId) ?? null;

  useLayoutEffect(() => {
    const el = scroller.current;
    const day = el?.querySelector<HTMLElement>("[data-today]");
    if (!phone || !el || !day || scrolledToToday.current) return;
    scrolledToToday.current = true;
    el.scrollTo({ left: day.offsetLeft, behavior: "instant" });
  }, [phone, view, today]);

  function toggleDay(ymd: string) {
    const selected = filter?.kind === "day" && filter.ymd === ymd;
    setFilter(selected ? null : { kind: "day", ymd });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const data = active.data.current as ChipData | undefined;
    const task = board.tasks.find((t) => t.id === data?.taskId);
    const to = over ? ymdOfDayId(over.id) : null;
    if (task && to && task.dueDate !== to) void board.rescheduleTask(task, to);
  }

  return (
    <section
      id="cal"
      aria-labelledby="cal-heading"
      data-cal-root
      className="flex flex-none flex-col overflow-hidden rounded-xl border bg-card text-card-foreground max-[899px]:scroll-mt-16"
    >
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3.5 py-2">
        <h2 id="cal-heading" className="m-0 text-[13px] leading-5 font-semibold">
          {view === "week" ? "Week" : "Month"}
        </h2>
        <span className="text-xs text-muted-foreground">
          {view === "week" ? "tasks by due date · drag to reschedule" : "tasks by due date"}
        </span>
        <FilterChip />
        <div className="ml-auto flex items-center gap-2">
          {view === "month" && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="previous month"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className={NAV}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <span aria-live="polite" className="min-w-[7.5rem] text-center text-xs font-medium tabular-nums">
                {fmtYmd(`${month.year}-${String(month.month).padStart(2, "0")}-01`, "MMMM yyyy")}
              </span>
              <button
                type="button"
                aria-label="next month"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className={NAV}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          )}
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(next) => next && setView(next as View)}
            aria-label="Calendar view"
          >
            <ToggleGroupItem value="week" className={TOGGLE}>
              Week
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className={TOGGLE}>
              Month
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div
        ref={scroller}
        className="relative overflow-x-auto max-[899px]:snap-x max-[899px]:snap-mandatory max-[899px]:overscroll-x-contain"
      >
        {view === "week" ? (
          <DndContext
            sensors={sensors}
            accessibility={{ announcements: calAnnouncements, screenReaderInstructions: CAL_INSTRUCTIONS }}
            onDragStart={({ active }: DragStartEvent) => setActiveId((active.data.current as ChipData).taskId)}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid grid-cols-7 max-[899px]:grid-cols-[repeat(7,minmax(7rem,1fr))]">
              {days.map((ymd) => (
                <DayColumn
                  key={ymd}
                  ymd={ymd}
                  today={today}
                  tasks={tasksOn(ymd)}
                  selected={filter?.kind === "day" && filter.ymd === ymd}
                  projectOf={projectOf}
                  onToggleDay={toggleDay}
                  onOpen={openTask}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {active && <ChipPreview task={active} project={projectOf(active.projectId)} today={today} />}
            </DragOverlay>
          </DndContext>
        ) : (
          <MonthView month={month} today={today} tasksOn={tasksOn} projectOf={projectOf} onOpen={openTask} />
        )}
      </div>
    </section>
  );
}
