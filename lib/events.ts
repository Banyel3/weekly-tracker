import { EventType, Status, type Prisma, type Task } from "@prisma/client";
import type { UpdateTaskInput } from "./tasks";
import { currentWeekStart, dateToYmd, ymdToDate } from "./week";

export type EventInput = { taskId: string; type: EventType; at?: Date; from?: string | null; to?: string | null };
export type EventChange = Omit<EventInput, "taskId" | "at">;

type EventWriter = Pick<Prisma.TransactionClient, "taskEvent">;

export function eventRows(events: EventInput[], now: Date = new Date()): Prisma.TaskEventCreateManyInput[] {
  return events.map(({ taskId, type, at = now, from = null, to = null }) => ({
    taskId,
    type,
    at,
    weekOf: ymdToDate(currentWeekStart(at)),
    from,
    to,
  }));
}

export async function recordEvents(tx: EventWriter, events: EventInput[], now: Date = new Date()): Promise<void> {
  if (events.length === 0) return;
  await tx.taskEvent.createMany({ data: eventRows(events, now) });
}

/** Backlog and Future sit outside the week: moving between them plans nothing. */
const unplanned = (status: Status | null) => status === null || status === Status.BACKLOG || status === Status.FUTURE;

/** `previous` is null for a new task. One move can emit several events, e.g. BACKLOG → DONE is PLANNED + DONE. */
export function statusEvents(previous: Status | null, next: Status): EventType[] {
  if (previous === next) return [];
  const types: EventType[] = [];
  if (unplanned(previous) && !unplanned(next)) types.push(EventType.PLANNED);
  if (previous === Status.DONE) types.push(EventType.REOPENED);
  if (!unplanned(previous) && unplanned(next)) types.push(EventType.UNPLANNED);
  if (next === Status.IN_PROGRESS) types.push(EventType.STARTED);
  if (next === Status.DONE) types.push(EventType.DONE);
  return types;
}

export function createEvents(status: Status): EventChange[] {
  return [EventType.CREATED, ...statusEvents(null, status)].map((type) => ({ type, to: status }));
}

const NO_DATE = "none";

/** Mirrors updateData's precedence: a restore overrides any status in the same patch. */
export function updateEvents(input: UpdateTaskInput, existing: Task): EventChange[] {
  const changes: EventChange[] = [];
  if (input.archived === false && existing.archived) changes.push({ type: EventType.RESTORED });
  else if (input.status !== undefined) {
    for (const type of statusEvents(existing.status, input.status)) {
      changes.push({ type, from: existing.status, to: input.status });
    }
  }
  if (input.dueDate !== undefined) {
    const from = existing.dueDate ? dateToYmd(existing.dueDate) : NO_DATE;
    const to = input.dueDate ?? NO_DATE;
    if (from !== to) changes.push({ type: EventType.RESCHEDULED, from, to });
  }
  return changes;
}
