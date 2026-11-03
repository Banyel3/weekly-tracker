import { EventType, Status } from "@prisma/client";
import { setState } from "./appState";
import { prisma } from "./db";
import { recordEvents } from "./events";
import { LAST_ROLLOVER_KEY } from "./health";
import { currentWeekStart, ymdToDate } from "./week";

export type RolloverResult = { archived: number; returnedToBacklog: number };

let inFlight: Promise<RolloverResult> | null = null;

/**
 * The weekly and hourly crons both fire at Monday 00:00, so concurrent callers in this process share one run.
 * Across processes, FOR UPDATE makes a second transaction wait and then skip the rows the first one changed,
 * so events are written only for rows this run actually rolled over.
 */
export function rolloverStaleTasks(now: Date = new Date()): Promise<RolloverResult> {
  inFlight ??= runRollover(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

type StaleRow = { id: string; status: Status };

async function runRollover(now: Date): Promise<RolloverResult> {
  const weekStartYmd = currentWeekStart(now);
  const weekStart = ymdToDate(weekStartYmd);
  const stale = { archived: false, weekOf: { lt: weekStart } };

  const [archived, returned] = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<StaleRow[]>`
      SELECT id, status::text AS status FROM "Task"
      WHERE archived = false AND "weekOf" < ${weekStartYmd}::date
      FOR UPDATE`;
    const archiveIds = rows.filter((r) => r.status === Status.DONE).map((r) => r.id);
    const returnIds = rows.filter((r) => r.status !== Status.DONE).map((r) => r.id);
    if (rows.length === 0) return [0, 0];

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
    await recordEvents(
      tx,
      [
        ...archiveIds.map((taskId) => ({ taskId, type: EventType.ARCHIVED })),
        ...returnIds.map((taskId) => ({ taskId, type: EventType.ROLLED_BACK })),
      ],
      now,
    );
    return [archivedRows.count, returnedRows.count];
  });
  if (archived + returned > 0) await setState(LAST_ROLLOVER_KEY, now.toISOString());

  console.log(`[rollover] archived=${archived} backlog=${returned}`);
  return { archived, returnedToBacklog: returned };
}
