import type { EventType } from "@prisma/client";
import { currentWeekStart } from "./week";

export type InsightEvent = {
  taskId: string;
  type: EventType;
  at: string;
  weekOf: string | null;
  from: string | null;
  to: string | null;
};

type CarryEvent = Pick<InsightEvent, "taskId" | "type" | "at" | "weekOf">;

const ms = (iso: string) => new Date(iso).getTime();

export const weekOfEvent = (e: Pick<InsightEvent, "at" | "weekOf">) => e.weekOf ?? currentWeekStart(new Date(e.at));

/** Tasks whose latest DELETED / RESTORED event is a delete: their history stays but they no longer count. */
export function deletedTaskIds(events: CarryEvent[]): Set<string> {
  const deleted = new Set<string>();
  for (const e of [...events].sort((a, b) => ms(a.at) - ms(b.at))) {
    if (e.type === "DELETED") deleted.add(e.taskId);
    if (e.type === "RESTORED") deleted.delete(e.taskId);
  }
  return deleted;
}

/** Tasks the rollover returned to Backlog at the start of `week`, minus deleted ones. Shared by board, review and insights. */
export function carriedTaskIds(events: CarryEvent[], week: string): string[] {
  const deleted = deletedTaskIds(events);
  const ids = events
    .filter((e) => e.type === "ROLLED_BACK" && weekOfEvent(e) === week && !deleted.has(e.taskId))
    .map((e) => e.taskId);
  return [...new Set(ids)];
}
