import cron from "node-cron";
import { rolloverStaleTasks } from "./rollover";
import { sendDueTodayReminder } from "./reminders";
import { TIMEZONE } from "./week";

declare global {
  var __schedulerStarted: boolean | undefined;
}

export async function startScheduler(): Promise<void> {
  if (globalThis.__schedulerStarted) return;
  globalThis.__schedulerStarted = true;

  try {
    await rolloverStaleTasks();
  } catch (err) {
    console.error("[scheduler] startup rollover failed:", err);
  }

  cron.schedule("0 0 * * 1", () => void rolloverStaleTasks().catch(console.error), {
    timezone: TIMEZONE,
  });

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    cron.schedule("0 9 * * *", () => void sendDueTodayReminder().catch(console.error), {
      timezone: TIMEZONE,
    });
    console.log("[scheduler] telegram reminders enabled");
  } else {
    console.log("[scheduler] telegram reminders disabled");
  }
}
