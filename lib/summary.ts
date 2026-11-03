import { setState } from "./appState";
import { sendTelegram, telegramConfigured } from "./reminders";
import { getReview } from "./review";
import { buildWeeklySummaryText } from "./summaryText";
import { todayYmd } from "./week";

export { buildWeeklySummaryText };

export const SUMMARY_SENT_KEY = "lastSentOn:summary";

export async function sendWeeklySummary(now: Date = new Date()): Promise<void> {
  if (!telegramConfigured()) return;
  const text = buildWeeklySummaryText(await getReview(now));
  if (await sendTelegram(text, "summary")) await setState(SUMMARY_SENT_KEY, todayYmd(now));
}
