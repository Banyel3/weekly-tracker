import { EventType, Status, type Prisma } from "@prisma/client";
import { setState } from "./appState";
import { prisma } from "./db";
import { recordEvents } from "./events";
import { LAST_ROLLOVER_KEY } from "./health";
import { currentWeekStart, ymdToDate } from "./week";

export async function rolloverStaleTasks(
  now: Date = new Date(),
): Promise<{ archived: number; returnedToBacklog: number }> {
  const weekStart = ymdToDate(currentWeekStart(now));
  const stale = { archived: false, weekOf: { lt: weekStart } };

  const [archived, returned] = await prisma.$transaction(async (tx) => {
    const ids = async (status: Prisma.TaskWhereInput["status"]) =>
      (await tx.task.findMany({ where: { ...stale, status }, select: { id: true } })).map((t) => t.id);
    const archiveIds = await ids(Status.DONE);
    const returnIds = await ids({ not: Status.DONE });
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
    return [archivedRows, returnedRows];
  });
  await setState(LAST_ROLLOVER_KEY, now.toISOString());

  console.log(`[rollover] archived=${archived.count} backlog=${returned.count}`);
  return { archived: archived.count, returnedToBacklog: returned.count };
}
