import type { TaskDto } from "@/lib/tasks";

export type Status = TaskDto["status"];

export const COLUMNS: { status: Status; label: string }[] = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "THIS_WEEK", label: "This week" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "DONE", label: "Done" },
];

/** Future is a status but not a board column; it has its own page. */
export const FUTURE: { status: Status; label: string } = { status: "FUTURE", label: "Future" };

/** Every status the dialog can give a task, furthest out first. */
export const STATUS_OPTIONS = [FUTURE, ...COLUMNS];

export const statusVar = (status: Status) => `var(--status-${status.toLowerCase().replace("_", "-")})`;

export const statusLabel = (status: Status) => STATUS_OPTIONS.find((c) => c.status === status)?.label ?? status;
