import { Status } from "@prisma/client";
import { prisma } from "./db";
import { currentWeekStart, ymdToDate } from "./week";

export async function rolloverStaleTasks(
  now: Date = new Date(),
): Promise<{ archived: number; returnedToBacklog: number }> {
  const weekStart = ymdToDate(currentWeekStart(now));
  const stale = { archived: false, weekOf: { lt: weekStart } };

  const archived = await prisma.task.updateMany({
    where: { ...stale, status: Status.DONE },
    data: { archived: true },
  });
  const returned = await prisma.task.updateMany({
    where: { ...stale, status: { not: Status.DONE } },
    data: { status: Status.BACKLOG, weekOf: null, rolledBackAt: weekStart },
  });

  console.log(`[rollover] archived=${archived.count} backlog=${returned.count}`);
  return { archived: archived.count, returnedToBacklog: returned.count };
}
