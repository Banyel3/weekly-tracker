import { EventType, Priority, Status, type Prisma, type Task } from "@prisma/client";
import { z } from "zod";
import { checklistSchema, normalizeChecklist, readChecklist, type ChecklistItem } from "./checklist";
import { prisma } from "./db";
import { createEvents, recordEvents, updateEvents, type EventChange } from "./events";
import { listProjects, type ProjectDto } from "./projects";
import { currentWeekStart, dateToYmd, todayYmd, weekRange, ymdToDate, type WeekRange } from "./week";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  note: z.string().max(2000).nullish(),
  dueDate: ymd.nullish(),
  status: z.nativeEnum(Status).default("BACKLOG"),
  projectId: z.string().nullish(),
  priority: z.nativeEnum(Priority).default("NONE"),
  checklist: checklistSchema.default([]),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({
    status: z.nativeEnum(Status).optional(),
    priority: z.nativeEnum(Priority).optional(),
    checklist: checklistSchema.optional(),
    archived: z.literal(false).optional(),
    rolledBackAt: ymd.nullable().optional(),
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export type TaskDto = {
  id: string;
  title: string;
  note: string | null;
  dueDate: string | null;
  status: Status;
  weekOf: string | null;
  rolledBackAt: string | null;
  projectId: string | null;
  priority: Priority;
  checklist: ChecklistItem[];
  rolloverCount: number;
  completedAt: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    note: task.note,
    dueDate: task.dueDate ? dateToYmd(task.dueDate) : null,
    status: task.status,
    weekOf: task.weekOf ? dateToYmd(task.weekOf) : null,
    rolledBackAt: task.rolledBackAt ? dateToYmd(task.rolledBackAt) : null,
    projectId: task.projectId,
    priority: task.priority,
    checklist: readChecklist(task.checklist),
    rolloverCount: task.rolloverCount,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    archived: task.archived,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function weekOfFor(status: Status, now?: Date): Date | null {
  return status === Status.BACKLOG ? null : ymdToDate(currentWeekStart(now));
}

function optionalDate(value: string | null | undefined): Date | null | undefined {
  return value == null ? value : ymdToDate(value);
}

const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, NONE: 2 };

export function sortColumn(tasks: TaskDto[], weekStart: string = currentWeekStart()): TaskDto[] {
  const rolledBack = (t: TaskDto) => (t.rolledBackAt === weekStart ? 0 : 1);
  return [...tasks].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      rolledBack(a) - rolledBack(b) ||
      compareNullsLast(a.dueDate, b.dueDate) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

function compareNullsLast(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

export type BoardCounts = { live: number; archived: number; nudges: number };

export type BoardDto = {
  week: WeekRange;
  today: string;
  projects: ProjectDto[];
  tasks: TaskDto[];
  counts: BoardCounts;
};

export async function listBoard(now: Date = new Date()): Promise<BoardDto> {
  const week = weekRange(now);
  const [projects, tasks, live, archived, nudges] = await Promise.all([
    listProjects(),
    prisma.task.findMany({
      where: { archived: false, OR: [{ status: Status.BACKLOG }, { weekOf: ymdToDate(week.start) }] },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.count({ where: { archived: false } }),
    prisma.task.count({ where: { archived: true } }),
    prisma.task.count({ where: { archived: false, status: Status.BACKLOG, rolloverCount: { gte: 2 } } }),
  ]);
  const dtos = tasks.map(toDto);
  const sorted = Object.values(Status).flatMap((status) =>
    sortColumn(
      dtos.filter((t) => t.status === status),
      week.start,
    ),
  );
  return { week, today: todayYmd(now), projects, tasks: sorted, counts: { live, archived, nudges } };
}

function completedAtFor(status: Status, previous: Task | null, now: Date): Date | null {
  if (status !== Status.DONE) return null;
  return previous?.status === Status.DONE ? previous.completedAt ?? now : now;
}

export async function createTask(input: CreateTaskInput): Promise<TaskDto> {
  const now = new Date();
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: input.title,
        note: input.note ?? null,
        dueDate: optionalDate(input.dueDate) ?? null,
        status: input.status,
        weekOf: weekOfFor(input.status, now),
        projectId: input.projectId ?? null,
        priority: input.priority,
        checklist: normalizeChecklist(input.checklist),
        completedAt: completedAtFor(input.status, null, now),
      },
    });
    await recordEvents(tx, withTask(created.id, createEvents(input.status)), now);
    return created;
  });
  return toDto(task);
}

function withTask(taskId: string, changes: EventChange[]) {
  return changes.map((change) => ({ taskId, ...change }));
}

/** Order matters: an explicit rolledBackAt (move undo) overrides the status reset; a restore overrides both. */
export function updateData(input: UpdateTaskInput, existing: Task, now: Date): Prisma.TaskUncheckedUpdateInput {
  return {
    title: input.title,
    note: input.note,
    dueDate: optionalDate(input.dueDate),
    projectId: input.projectId,
    priority: input.priority,
    ...(input.checklist !== undefined && { checklist: normalizeChecklist(input.checklist) }),
    ...(input.status !== undefined && {
      status: input.status,
      weekOf: weekOfFor(input.status, now),
      rolledBackAt: null,
      completedAt: completedAtFor(input.status, existing, now),
    }),
    ...(input.rolledBackAt !== undefined && { rolledBackAt: optionalDate(input.rolledBackAt) }),
    ...(input.archived === false &&
      existing.archived && {
        archived: false,
        status: Status.BACKLOG,
        weekOf: null,
        completedAt: null,
        rolledBackAt: null,
      }),
  };
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDto | null> {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return null;
  const now = new Date();
  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data: updateData(input, existing, now) });
    await recordEvents(tx, withTask(id, updateEvents(input, existing)), now);
    return updated;
  });
  return toDto(task);
}

export async function deleteTask(id: string): Promise<TaskDto | null> {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return null;
  const deleted = await prisma.$transaction(async (tx) => {
    await recordEvents(tx, [{ taskId: id, type: EventType.DELETED }]);
    return tx.task.delete({ where: { id } });
  });
  return toDto(deleted);
}
