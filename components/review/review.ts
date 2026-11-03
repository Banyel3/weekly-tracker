import { formatInTimeZone } from "date-fns-tz";
import type { InsightsDto } from "../../lib/insights";
import type { ReviewDto } from "../../lib/review";
import type { TaskDto } from "../../lib/tasks";
import { ymdToDate, type WeekRange } from "../../lib/week";
import { isoWeekday } from "../stats/stats";
import { deletedLabel, movedLabel, type UndoLineState } from "../useUndo";

export type CarriedEntry = ReviewDto["carried"][number];
export type Decision = "moved" | "kept" | "deleted";
/** lineId ties a move or delete to the shared undo line that can still reverse it; null until that line shows. */
export type Decided = { kind: Decision; entry: CarriedEntry; index: number; lineId: number | null };
export type DecidedMap = Record<string, Decided>;
export type DecidedAction =
  | { type: "decide"; id: string; kind: Decision; entry: CarriedEntry; index: number }
  | { type: "clear"; id: string }
  | { type: "line"; line: UndoLineState | null };
export type CarriedRow = { entry: CarriedEntry; decided: Decided | null };

export const THIS_WEEK_LABEL = "This week";

const mmmd = (ymd: string) => formatInTimeZone(ymdToDate(ymd), "UTC", "MMM d");

export function headline(w: ReviewDto["thisWeek"]): { main: string; overdue: string } {
  return { main: `Finished ${w.finished} of ${w.planned} planned · ${w.inProgress} in progress`, overdue: `${w.overdue} overdue` };
}

export function originLine(o: InsightsDto["origin"]): string {
  return `carried in ${o.carriedIn} (${o.finishedCarried} finished) · added ${o.addedThisWeek} (${o.finishedNew} finished)`;
}

export const EMPTY = "—";

export function daysText(days: number | null): string {
  if (days === null) return EMPTY;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function shareText(share: number | null): string {
  return share === null ? EMPTY : `${Math.round(share * 100)}%`;
}

export function completionLine(trend: InsightsDto["trend"]): string | null {
  const planned = trend.reduce((sum, w) => sum + w.planned, 0);
  const finished = trend.reduce((sum, w) => sum + w.finished, 0);
  if (planned === 0) return null;
  return `completion ${Math.round((finished / planned) * 100)}% over ${trend.length} weeks`;
}

export function droppedLine(trend: InsightsDto["trend"]): string | null {
  const dropped = trend.reduce((sum, w) => sum + w.dropped, 0);
  return dropped > 0 ? `${dropped} dropped` : null;
}

export const THIS_WEEK_TICK = "this week";

export function trendTick(weekStart: string, current: string): string {
  return weekStart === current ? THIS_WEEK_TICK : mmmd(weekStart);
}

export function trendLabel(trend: InsightsDto["trend"]): string {
  const weeks = trend.map((w) => `${mmmd(w.weekStart)}: planned ${w.planned}, finished ${w.finished}`);
  return `Planned and finished per week. ${weeks.join("; ")}`;
}

export function dayLine(today: string): string {
  return `${formatInTimeZone(ymdToDate(today), "UTC", "EEE")}, day ${isoWeekday(today)} of 7`;
}

export function lastWeekHeading(range: WeekRange): string {
  return `Last week · ${mmmd(range.start)} – ${mmmd(range.end)}`;
}

export function lastWeekLine(last: ReviewDto["lastWeek"]): string {
  if (last.planned === 0) return "no data for last week";
  return `Finished ${last.finished} of ${last.planned} planned. ${last.carried} carried over.`;
}

export function decidedText(kind: Decision, title: string): string {
  if (kind === "moved") return `moved to ${THIS_WEEK_LABEL}`;
  if (kind === "kept") return "kept in Backlog";
  return deletedLabel(title);
}

const TREND_COLORS: Record<string, string> = { planned: "var(--chart-2)", finished: "var(--primary)" };

export function trendColor(weekStart: string, category: string, current: string): string {
  const color = TREND_COLORS[category];
  return weekStart === current ? color : `color-mix(in oklch, ${color} 55%, transparent)`;
}

/** Same rule as the server's counts.nudges, so the sidebar badge follows optimistic board changes. */
export function nudgeCount(tasks: TaskDto[]): number {
  return tasks.filter((t) => !t.archived && t.status === "BACKLOG" && t.rolloverCount >= 2).length;
}

function undoLabel(d: Decided): string | null {
  if (d.kind === "moved") return movedLabel(d.entry.task.title, THIS_WEEK_LABEL);
  if (d.kind === "deleted") return deletedLabel(d.entry.task.title);
  return null;
}

function onLine(state: DecidedMap, line: UndoLineState | null): DecidedMap {
  let changed = false;
  const next: DecidedMap = {};
  for (const [id, d] of Object.entries(state)) {
    const label = undoLabel(d);
    if (label === null) next[id] = d;
    else if (d.lineId === null && line?.label === label) {
      next[id] = { ...d, lineId: line.id };
      changed = true;
    } else if (d.lineId !== null && line?.id !== d.lineId) changed = true;
    else next[id] = d;
  }
  return changed ? next : state;
}

export function decidedReducer(state: DecidedMap, action: DecidedAction): DecidedMap {
  if (action.type === "decide") {
    const { id, kind, entry, index } = action;
    return { ...state, [id]: { kind, entry, index, lineId: null } };
  }
  if (action.type === "clear") {
    if (!(action.id in state)) return state;
    const { [action.id]: _gone, ...rest } = state;
    return rest;
  }
  return onLine(state, action.line);
}

/**
 * Review rows reconciled with the board: an undecided row shows the board's live copy, in whatever column it is
 * now, and drops once the board no longer has the task (deleted). A decided row renders from its snapshot, at its
 * old position, even after the refetched review no longer lists it.
 */
export function carriedRows(carried: CarriedEntry[], decided: DecidedMap, live: Map<string, TaskDto> | null): CarriedRow[] {
  const rows: CarriedRow[] = [];
  for (const entry of carried) {
    const d = decided[entry.task.id];
    if (d) {
      rows.push({ entry: d.entry, decided: d });
      continue;
    }
    if (!live) {
      rows.push({ entry, decided: null });
      continue;
    }
    const task = live.get(entry.task.id);
    if (task) rows.push({ entry: { ...entry, task }, decided: null });
  }
  const listed = new Set(carried.map((c) => c.task.id));
  const vanished = Object.entries(decided)
    .filter(([id]) => !listed.has(id))
    .sort(([, x], [, y]) => x.index - y.index);
  for (const [, d] of vanished) {
    rows.splice(Math.min(d.index, rows.length), 0, { entry: d.entry, decided: d });
  }
  return rows;
}
