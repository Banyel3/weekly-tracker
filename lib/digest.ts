import { EventType, Status } from "@prisma/client";
import { setState } from "./appState";
import { carriedTaskIds } from "./carried";
import { prisma } from "./db";
import { buildMorningDigest, type DigestData } from "./digestText";
import { REMINDER_SENT_KEY, sendTelegram, telegramConfigured } from "./reminders";
import { dateToYmd, todayYmd, weekRange, ymdToDate } from "./week";

/** Open tasks in any column plus this week's carry events; every count is derived in memory. */
export async function loadDigestData(now: Date = new Date()): Promise<DigestData> {
  const week = weekRange(now);
  const [tasks, carryEvents] = await Promise.all([
    prisma.task.findMany({
      where: { archived: false, status: { not: Status.DONE } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        priority: true,
        weekOf: true,
        createdAt: true,
        project: { select: { name: true } },
      },
    }),
    prisma.taskEvent.findMany({
      where: { weekOf: ymdToDate(week.start), type: { in: [EventType.ROLLED_BACK, EventType.DELETED, EventType.RESTORED] } },
      select: { taskId: true, type: true, at: true },
    }),
  ]);

  const open = new Set(tasks.map((t) => t.id));
  const carried = carriedTaskIds(
    carryEvents.map((e) => ({ ...e, at: e.at.toISOString(), weekOf: week.start })),
    week.start,
  ).filter((id) => open.has(id)).length;

  return {
    today: todayYmd(now),
    week,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate ? dateToYmd(t.dueDate) : null,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
      projectName: t.project?.name ?? null,
    })),
    inProgress: tasks.filter((t) => t.status === Status.IN_PROGRESS).length,
    openThisWeek: tasks.filter((t) => t.weekOf !== null && dateToYmd(t.weekOf) === week.start).length,
    carried,
  };
}

/** Always sends (the quiet-day note counts); the marker is written only after Telegram accepts it. */
export async function sendMorningDigest(now: Date = new Date()): Promise<void> {
  if (!telegramConfigured()) return;
  const text = buildMorningDigest(await loadDigestData(now));
  if (await sendTelegram(text, "reminders")) await setState(REMINDER_SENT_KEY, todayYmd(now));
}
