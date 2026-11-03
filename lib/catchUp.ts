import { formatInTimeZone } from "date-fns-tz";
import { getState } from "./appState";
import { sendMorningDigest } from "./digest";
import { REMINDER_SENT_KEY, telegramConfigured } from "./reminders";
import { SUMMARY_SENT_KEY, sendWeeklySummary } from "./summary";
import { TIMEZONE, todayYmd } from "./week";

export type SentMarkers = { reminder: string | null; summary: string | null };

export function decideCatchUp(now: Date, state: SentMarkers): { reminder: boolean; summary: boolean } {
  const today = todayYmd(now);
  const hhmm = formatInTimeZone(now, TIMEZONE, "HH:mm");
  const isFriday = formatInTimeZone(now, TIMEZONE, "i") === "5";
  return {
    reminder: hhmm >= "09:00" && state.reminder !== today,
    summary: isFriday && hhmm >= "18:00" && state.summary !== today,
  };
}

export async function catchUpMissedJobs(now: Date = new Date()): Promise<void> {
  if (!telegramConfigured()) {
    console.log("[scheduler] catch-up reminder=false summary=false");
    return;
  }
  const due = decideCatchUp(now, {
    reminder: await getState(REMINDER_SENT_KEY),
    summary: await getState(SUMMARY_SENT_KEY),
  });
  console.log(`[scheduler] catch-up reminder=${due.reminder} summary=${due.summary}`);
  if (due.reminder) await sendMorningDigest(now);
  if (due.summary) await sendWeeklySummary(now);
}
