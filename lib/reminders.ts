import { Status } from "@prisma/client";
import { prisma } from "./db";
import { todayYmd, ymdToDate } from "./week";

export async function sendDueTodayReminder(now: Date = new Date()): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const today = todayYmd(now);
  const tasks = await prisma.task.findMany({
    where: { archived: false, status: { not: Status.DONE }, dueDate: ymdToDate(today) },
    orderBy: { createdAt: "asc" },
    select: { title: true },
  });
  if (tasks.length === 0) return;

  const text = [`Due today (${today}):`, ...tasks.map((t) => `• ${t.title}`)].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error(`[reminders] telegram responded ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[reminders] telegram request failed:", err);
  }
}
