import { getState } from "./appState";
import { prisma } from "./db";
import { currentWeekStart } from "./week";

/** When a rollover last archived or returned at least one task; empty hourly checks leave it unchanged. */
export const LAST_ROLLOVER_KEY = "lastRolloverAt";

export type Health = { ok: true; db: true; weekStart: string; lastRolloverAt: string | null };

/** Throws when the database is unreachable; the route maps that to 503. */
export async function getHealth(now: Date = new Date()): Promise<Health> {
  await prisma.$queryRaw`SELECT 1`;
  const lastRolloverAt = await getState(LAST_ROLLOVER_KEY);
  return { ok: true, db: true, weekStart: currentWeekStart(now), lastRolloverAt };
}
