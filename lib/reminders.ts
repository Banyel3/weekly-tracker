import { Status } from "@prisma/client";
import { setState } from "./appState";
import { prisma } from "./db";
import { todayYmd, ymdToDate } from "./week";

export const REMINDER_SENT_KEY = "lastSentOn:reminder";

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Returns true when Telegram accepted the message; logs and returns false otherwise. */
export async function sendTelegram(text: string, tag: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error(`[${tag}] telegram responded ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[${tag}] telegram request failed:`, err);
    return false;
  }
}

export async function sendDueTodayReminder(now: Date = new Date()): Promise<void> {
  if (!telegramConfigured()) return;

  const today = todayYmd(now);
  const tasks = await prisma.task.findMany({
    where: { archived: false, status: { not: Status.DONE }, dueDate: ymdToDate(today) },
    orderBy: { createdAt: "asc" },
    select: { title: true },
  });
  if (tasks.length > 0) {
    const text = [`Due today (${today}):`, ...tasks.map((t) => `• ${t.title}`)].join("\n");
    if (!(await sendTelegram(text, "reminders"))) return;
  }
  await setState(REMINDER_SENT_KEY, today);
}
