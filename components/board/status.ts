import type { TaskDto } from "@/lib/tasks";

export type Status = TaskDto["status"];

export const COLUMNS: { status: Status; label: string }[] = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "THIS_WEEK", label: "This week" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "DONE", label: "Done" },
];

export const statusVar = (status: Status) => `var(--status-${status.toLowerCase().replace("_", "-")})`;

export const statusLabel = (status: Status) => COLUMNS.find((c) => c.status === status)?.label ?? status;
