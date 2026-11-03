import type { TaskDto } from "@/lib/tasks";

/** Carried ids come from the server's ROLLED_BACK events; counting the ones still loaded follows deletes at once. */
export function backCount(carriedIds: string[], tasks: TaskDto[]): number {
  const live = new Set(tasks.map((t) => t.id));
  return carriedIds.filter((id) => live.has(id)).length;
}
