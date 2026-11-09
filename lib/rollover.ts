import { EventType, Status } from "@prisma/client";
import { setState } from "./appState";
import { prisma } from "./db";
import { recordEvents } from "./events";
import { LAST_ROLLOVER_KEY } from "./health";
import { weekRange, ymdToDate } from "./week";

export type RolloverResult = { archived: number; returnedToBacklog: number; promoted: number };

let inFlight: Promise<RolloverResult> | null = null;

/**
 * The weekly and hourly crons both fire at Monday 00:00, so concurrent callers in this process share one run.
 * Across processes, FOR UPDATE makes a second transaction wait and then skip the rows the first one changed,
 * so events are written only for rows this run actually rolled over.
 * Every run also moves Future tasks due by this Sunday into This week, under the same lock.
 */
export function rolloverStaleTasks(now: Date = new Date()): Promise<RolloverResult> {
  inFlight ??= runRollover(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

type LockedRow = { id: string; status: Status };

async function runRollover(now: Date): Promise<RolloverResult> {
  const { start: weekStartYmd, end: weekEndYmd } = weekRange(now);
  const weekStart = ymdToDate(weekStartYmd);
  const stale = { archived: false, weekOf: { lt: weekStart } };

  const [archived, returned, promoted] = await prisma.$transaction(async (tx) => {
    // Future rows have no weekOf, so the two halves of the OR never pick the same row.
    const rows = await tx.$queryRaw<LockedRow[]>`
      SELECT id, status::text AS status FROM "Task"
      WHERE archived = false
        AND ("weekOf" < ${weekStartYmd}::date OR (status = 'FUTURE' AND "dueDate" <= ${weekEndYmd}::date))
      FOR UPDATE`;
    const idsWhere = (keep: (status: Status) => boolean) => rows.filter((r) => keep(r.status)).map((r) => r.id);
    const archiveIds = idsWhere((s) => s === Status.DONE);
    const returnIds = idsWhere((s) => s !== Status.DONE && s !== Status.FUTURE);
    const promoteIds = idsWhere((s) => s === Status.FUTURE);
    if (rows.length === 0) return [0, 0, 0];

    const archivedRows = await tx.task.updateMany({
      where: { ...stale, id: { in: archiveIds }, status: Status.DONE },
      data: { archived: true, rolloverCount: 0 },
    });
    const returnedRows = await tx.task.updateMany({
      where: { ...stale, id: { in: returnIds }, status: { not: Status.DONE } },
      data: {
        status: Status.BACKLOG,
        weekOf: null,
        rolledBackAt: weekStart,
        rolloverCount: { increment: 1 },
      },
    });
    const promotedRows = await tx.task.updateMany({
      where: { id: { in: promoteIds }, archived: false, status: Status.FUTURE },
      data: { status: Status.THIS_WEEK, weekOf: weekStart },
    });
    await recordEvents(
      tx,
      [
        ...archiveIds.map((taskId) => ({ taskId, type: EventType.ARCHIVED })),
        ...returnIds.map((taskId) => ({ taskId, type: EventType.ROLLED_BACK })),
        ...promoteIds.map((taskId) => ({ taskId, type: EventType.PLANNED, from: Status.FUTURE, to: Status.THIS_WEEK })),
      ],
      now,
    );
    return [archivedRows.count, returnedRows.count, promotedRows.count];
  });
  if (archived + returned > 0) await setState(LAST_ROLLOVER_KEY, now.toISOString());

  console.log(`[rollover] archived=${archived} backlog=${returned} promoted=${promoted}`);
  return { archived, returnedToBacklog: returned, promoted };
}
