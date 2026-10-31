import { Status } from "@prisma/client";
import { setState } from "./appState";
import { prisma } from "./db";
import { LAST_ROLLOVER_KEY } from "./health";
import { currentWeekStart, ymdToDate } from "./week";

export async function rolloverStaleTasks(
  now: Date = new Date(),
): Promise<{ archived: number; returnedToBacklog: number }> {
  const weekStart = ymdToDate(currentWeekStart(now));
  const stale = { archived: false, weekOf: { lt: weekStart } };

  const archived = await prisma.task.updateMany({
    where: { ...stale, status: Status.DONE },
    data: { archived: true, rolloverCount: 0 },
  });
  const returned = await prisma.task.updateMany({
    where: { ...stale, status: { not: Status.DONE } },
    data: {
      status: Status.BACKLOG,
      weekOf: null,
      rolledBackAt: weekStart,
      rolloverCount: { increment: 1 },
    },
  });
  await setState(LAST_ROLLOVER_KEY, now.toISOString());

  console.log(`[rollover] archived=${archived.count} backlog=${returned.count}`);
  return { archived: archived.count, returnedToBacklog: returned.count };
}
