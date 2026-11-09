import type { BoardCounts, TaskDto } from "../../lib/tasks";

export type ClientCounts = BoardCounts & { future: number };

export const isFuture = (t: TaskDto) => t.status === "FUTURE" && !t.archived;

/** Dated tasks first by due date, then undated ones in the order they were added. */
export function futureRows(tasks: TaskDto[]): TaskDto[] {
  return tasks
    .filter(isFuture)
    .sort(
      (a, b) =>
        (a.dueDate === null ? 1 : 0) - (b.dueDate === null ? 1 : 0) ||
        (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

/**
 * The client keeps one live count for every live task, Future included, so adds and deletes bump a single number.
 * The Board and Future badges split it by the loaded Future tasks, so a task planned out of Future moves badges at once.
 */
export function splitCounts(counts: BoardCounts, tasks: TaskDto[]): ClientCounts {
  const future = tasks.filter(isFuture).length;
  return { ...counts, live: Math.max(0, counts.live - future), future };
}
