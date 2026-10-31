import cron from "node-cron";
import { catchUpMissedJobs } from "./catchUp";
import { rolloverStaleTasks } from "./rollover";
import { sendDueTodayReminder, telegramConfigured } from "./reminders";
import { sendWeeklySummary } from "./summary";
import { TIMEZONE } from "./week";

declare global {
  var __schedulerStarted: boolean | undefined;
}

function schedule(expression: string, job: () => Promise<unknown>): void {
  cron.schedule(expression, () => void job().catch(console.error), { timezone: TIMEZONE });
}

export async function startScheduler(): Promise<void> {
  if (globalThis.__schedulerStarted) return;
  globalThis.__schedulerStarted = true;

  try {
    await rolloverStaleTasks();
  } catch (err) {
    console.error("[scheduler] startup rollover failed:", err);
  }
  try {
    await catchUpMissedJobs();
  } catch (err) {
    console.error("[scheduler] catch-up failed:", err);
  }

  schedule("0 0 * * 1", () => rolloverStaleTasks());
  schedule("0 * * * *", () => rolloverStaleTasks());
  schedule("0 9 * * *", () => sendDueTodayReminder());
  schedule("0 18 * * 5", () => sendWeeklySummary());
  console.log("[scheduler] crons: rollover(weekly,hourly) reminder summary");
  console.log(`[scheduler] telegram ${telegramConfigured() ? "enabled" : "disabled"}`);
}
