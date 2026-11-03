import type { TaskEvent } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { carriedTaskIds, deletedTaskIds, weekOfEvent, type InsightEvent } from "./carried";
import { prisma } from "./db";
import { toDto, type TaskDto } from "./tasks";
import { TIMEZONE, currentWeekStart, dateToYmd, shiftYmd, todayYmd, ymdToDate } from "./week";

export type InsightsDto = {
  origin: {
    carriedIn: number;
    addedThisWeek: number;
    finishedCarried: number;
    finishedNew: number;
    addedAfterMonday: number;
  };
  flow: { medianCreatedToDoneDays: number | null; medianInProgressDays: number | null; reopened: number };
  signals: {
    reschedules: number;
    reschedulesPerPlanned: number | null;
    avgOverdueDaysBeforeDone: number | null;
    rolledTwice: number;
    oldestBacklogAgeDays: number | null;
    midWeekRatio: number | null;
  };
  trend: { weekStart: string; planned: number; finished: number; dropped: number }[];
  pattern: string | null;
};

export { carriedTaskIds, deletedTaskIds, type InsightEvent };

export type InsightsData = { tasks: TaskDto[]; events: InsightEvent[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WEEKS = 8;
const WAIT_DAYS = 14;
/** Below this many finishes in 8 weeks, any two weekdays trivially hold half of them. */
const MIN_DONE_FOR_DAYS = 5;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ms = (iso: string) => new Date(iso).getTime();
const manilaYmd = (iso: string) => formatInTimeZone(new Date(iso), TIMEZONE, "yyyy-MM-dd");
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const ratio = (n: number, d: number) => (d > 0 ? round(n / d, 2) : null);

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** DONE events of the week not undone by a later REOPENED of the same task in that week. */
function finishedIn(events: InsightEvent[], week: string): InsightEvent[] {
  const inWeek = events.filter((e) => weekOfEvent(e) === week);
  return inWeek.filter(
    (done) =>
      done.type === "DONE" &&
      !inWeek.some((e) => e.type === "REOPENED" && e.taskId === done.taskId && ms(e.at) > ms(done.at)),
  );
}

function createdTimes(tasks: TaskDto[], events: InsightEvent[]): Map<string, string> {
  const created = new Map(tasks.map((t) => [t.id, t.createdAt]));
  for (const e of events) if (e.type === "CREATED") created.set(e.taskId, e.at);
  return created;
}

function daysBetween(from: string, to: string): number {
  return (ms(to) - ms(from)) / DAY_MS;
}

function busiestDays(finished: InsightEvent[]): string | null {
  if (finished.length < MIN_DONE_FOR_DAYS) return null;
  const counts = WEEKDAYS.map(() => 0);
  for (const e of finished) counts[Number(formatInTimeZone(new Date(e.at), TIMEZONE, "i")) - 1] += 1;
  const top = counts
    .map((count, day) => ({ count, day }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || a.day - b.day)
    .slice(0, 2);
  if (top.length < 2 || (top[0].count + top[1].count) * 2 < finished.length) return null;
  const [a, b] = top.map((d) => d.day).sort((x, y) => x - y);
  return `you finish most on ${WEEKDAYS[a]} and ${WEEKDAYS[b]}`;
}

export function buildInsights(now: Date, { tasks, events }: InsightsData): InsightsDto {
  const week = currentWeekStart(now);
  const today = todayYmd(now);
  const tuesday = fromZonedTime(`${shiftYmd(week, 1)}T00:00:00`, TIMEZONE).getTime();
  const all = [...events].sort((a, b) => ms(a.at) - ms(b.at));
  const deleted = deletedTaskIds(all);
  const sorted = all.filter((e) => !deleted.has(e.taskId));
  const thisWeek = sorted.filter((e) => weekOfEvent(e) === week);
  const created = createdTimes(tasks, sorted);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const planned = tasks.filter((t) => t.weekOf === week);
  const finished = planned.filter((t) => t.status === "DONE");
  const carriedIds = new Set(carriedTaskIds(all, week));
  const createdThisWeek = new Set(
    planned.filter((t) => currentWeekStart(new Date(created.get(t.id) ?? t.createdAt)) === week).map((t) => t.id),
  );
  const firstPlanned = new Map<string, string>();
  for (const e of sorted) if (e.type === "PLANNED" && !firstPlanned.has(e.taskId)) firstPlanned.set(e.taskId, e.at);
  const carried = planned.filter((t) => carriedIds.has(t.id));
  const added = planned.filter((t) => createdThisWeek.has(t.id));
  const addedAfterMonday = added.filter((t) => {
    const at = firstPlanned.get(t.id);
    return at !== undefined && ms(at) >= tuesday;
  }).length;

  const doneThisWeek = finishedIn(sorted, week);
  const createdToDone: number[] = [];
  const inProgress: number[] = [];
  const overdue: number[] = [];
  for (const done of doneThisWeek) {
    const start = created.get(done.taskId);
    if (start) createdToDone.push(daysBetween(start, done.at));
    const started = sorted.filter((e) => e.type === "STARTED" && e.taskId === done.taskId && ms(e.at) <= ms(done.at));
    if (started.length > 0) inProgress.push(daysBetween(started[started.length - 1].at, done.at));
    const due = byId.get(done.taskId)?.dueDate;
    if (due) overdue.push(Math.max(0, daysBetween(`${due}T00:00:00Z`, `${manilaYmd(done.at)}T00:00:00Z`)));
  }

  const backlogAges = tasks
    .filter((t) => !t.archived && t.status === "BACKLOG")
    .map((t) => daysBetween(`${manilaYmd(created.get(t.id) ?? t.createdAt)}T00:00:00Z`, `${today}T00:00:00Z`));
  const reschedules = thisWeek.filter((e) => e.type === "RESCHEDULED").length;
  const midWeekRatio = ratio(addedAfterMonday, planned.length);

  const plannedIn = (list: InsightEvent[], weekStart: string) => {
    const last = new Map<string, InsightEvent["type"]>();
    for (const e of list) {
      if ((e.type === "PLANNED" || e.type === "UNPLANNED") && weekOfEvent(e) === weekStart) last.set(e.taskId, e.type);
    }
    return new Set([...last].filter(([, type]) => type === "PLANNED").map(([id]) => id));
  };
  const trend = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const weekStart = shiftYmd(week, (i - TREND_WEEKS + 1) * 7);
    const dropped = [...plannedIn(all, weekStart)].filter((id) => deleted.has(id)).length;
    if (weekStart === week) return { weekStart, planned: planned.length, finished: finished.length, dropped };
    const ids = plannedIn(sorted, weekStart);
    for (const t of tasks) if (t.weekOf === weekStart) ids.add(t.id);
    const done = new Set(finishedIn(sorted, weekStart).map((e) => e.taskId));
    return { weekStart, planned: ids.size, finished: done.size, dropped };
  });
  const trendDone = trend.flatMap((w) => finishedIn(sorted, w.weekStart));

  const firstStarts = new Map<string, string>();
  for (const e of thisWeek) if (e.type === "STARTED" && !firstStarts.has(e.taskId)) firstStarts.set(e.taskId, e.at);
  const waited = [...firstStarts].filter(([id, at]) => {
    const start = created.get(id);
    return start !== undefined && daysBetween(start, at) >= WAIT_DAYS;
  }).length;

  const pattern =
    busiestDays(trendDone) ??
    (waited >= 2 ? `${waited} tasks waited 2+ weeks before you started them` : null) ??
    (midWeekRatio !== null && midWeekRatio >= 0.5 && planned.length >= 4
      ? "half of this week's tasks were added after Monday"
      : null) ??
    (planned.length >= 1 ? `steady week: finished ${finished.length} of ${planned.length}` : null);

  const avg = (xs: number[]) => (xs.length ? round(xs.reduce((s, x) => s + x, 0) / xs.length, 1) : null);
  const medianDays = (xs: number[]) => {
    const m = median(xs);
    return m === null ? null : round(m, 1);
  };

  return {
    origin: {
      carriedIn: carried.length,
      addedThisWeek: added.length,
      finishedCarried: carried.filter((t) => t.status === "DONE").length,
      finishedNew: added.filter((t) => t.status === "DONE").length,
      addedAfterMonday,
    },
    flow: {
      medianCreatedToDoneDays: medianDays(createdToDone),
      medianInProgressDays: medianDays(inProgress),
      reopened: thisWeek.filter((e) => e.type === "REOPENED").length,
    },
    signals: {
      reschedules,
      reschedulesPerPlanned: ratio(reschedules, planned.length),
      avgOverdueDaysBeforeDone: avg(overdue),
      rolledTwice: tasks.filter((t) => !t.archived && t.rolloverCount >= 2).length,
      oldestBacklogAgeDays: backlogAges.length ? Math.max(...backlogAges) : null,
      midWeekRatio,
    },
    trend,
    pattern,
  };
}

function toInsightEvent(e: TaskEvent): InsightEvent {
  return {
    taskId: e.taskId,
    type: e.type,
    at: e.at.toISOString(),
    weekOf: e.weekOf ? dateToYmd(e.weekOf) : null,
    from: e.from,
    to: e.to,
  };
}

const HISTORY_WEEKS = 9;

export async function loadInsightsData(now: Date = new Date()): Promise<InsightsData> {
  const since = new Date(ymdToDate(currentWeekStart(now)).getTime() - HISTORY_WEEKS * 7 * DAY_MS);
  const [tasks, events] = await Promise.all([
    prisma.task.findMany({ where: { OR: [{ archived: false }, { updatedAt: { gte: since } }] } }),
    prisma.taskEvent.findMany({ where: { at: { gte: since } }, orderBy: { at: "asc" } }),
  ]);
  return { tasks: tasks.map(toDto), events: events.map(toInsightEvent) };
}
