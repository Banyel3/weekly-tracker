import type { CSSProperties } from "react";
import { formatInTimeZone } from "date-fns-tz";
import type { TaskDto } from "../../lib/tasks";
import { shiftYmd, ymdToDate, type WeekRange } from "../../lib/week";
import type { DialogTarget } from "../board/TaskDialog";
import type { Filter } from "../useFilters";

export type Month = { year: number; month: number };
/** future: a Future task, drawn fainter so it reads as parked rather than planned. */
export type ChipTone = { color: string | null; done: boolean; overdue: boolean; future?: boolean };

export const fmtYmd = (ymd: string, pattern: string) => formatInTimeZone(ymdToDate(ymd), "UTC", pattern);

/** "Thu 29": the product's short day name, used in announcements. */
export const dayLabel = (ymd: string) => fmtYmd(ymd, "EEE d");

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftYmd(start, i));
}

export function monthOf(ymd: string): Month {
  return { year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)) };
}

export function shiftMonth({ year, month }: Month, by: number): Month {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Six Monday-first weeks covering the month. */
export function monthGrid({ year, month }: Month): string[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const offset = (ymdToDate(first).getUTCDay() + 6) % 7;
  const start = shiftYmd(first, -offset);
  return Array.from({ length: 42 }, (_, i) => shiftYmd(start, i));
}

/** A day up to this week's Sunday (Manila) lands in This week, a later one in Future. */
export function addTarget(ymd: string, week: WeekRange): Extract<DialogTarget, { mode: "create" }> {
  return { mode: "create", initialStatus: ymd <= week.end ? "THIS_WEEK" : "FUTURE", dueDate: ymd };
}

export const addLabel = (ymd: string) => `Add task on ${fmtYmd(ymd, "EEE d MMM")}`;

/** A click in a day's free space, not on one of its chips or buttons. */
export const isEmptySpot = (target: EventTarget | null) => !(target as Element | null)?.closest?.("button, a");

export function isOverdue(task: TaskDto, today: string): boolean {
  return task.status !== "DONE" && task.dueDate !== null && task.dueDate < today;
}

/** The calendar follows the project filter only; search and day filters leave it whole. */
export function calendarTasks(tasks: TaskDto[], filter: Filter, from: string, to: string): TaskDto[] {
  return tasks.filter(
    (t) =>
      !t.archived &&
      t.dueDate !== null &&
      from <= t.dueDate &&
      t.dueDate <= to &&
      (filter?.kind !== "project" || t.projectId === filter.id),
  );
}

export function chipStyle({ color, done, overdue, future }: ChipTone): CSSProperties {
  const hue = `var(--project-${color ?? "slate"})`;
  const edge = overdue && !done ? "var(--alert)" : hue;
  return {
    background: `color-mix(in oklch, ${hue} ${future ? 8 : 22}%, transparent)`,
    boxShadow: `inset 3px 0 0 ${edge}`,
  };
}

export const DAY_PREFIX = "cal:day:";
export const TASK_PREFIX = "cal:task:";
export const dayId = (ymd: string) => `${DAY_PREFIX}${ymd}`;
export const ymdOfDayId = (id: string | number) => String(id).slice(DAY_PREFIX.length);
