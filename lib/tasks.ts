import { Status, type Task } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { currentWeekStart, dateToYmd, weekRange, ymdToDate, type WeekRange } from "./week";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  note: z.string().max(2000).nullish(),
  dueDate: ymd.nullish(),
  status: z.nativeEnum(Status).default("BACKLOG"),
});

export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export type TaskDto = {
  id: string;
  title: string;
  note: string | null;
  dueDate: string | null;
  status: Status;
  weekOf: string | null;
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

export async function listBoard(now?: Date): Promise<{ week: WeekRange; tasks: TaskDto[] }> {
  const week = weekRange(now);
  const tasks = await prisma.task.findMany({
    where: { archived: false, OR: [{ status: Status.BACKLOG }, { weekOf: ymdToDate(week.start) }] },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  return { week, tasks: tasks.map(toDto) };
}

export async function createTask(input: CreateTaskInput): Promise<TaskDto> {
  const task = await prisma.task.create({
    data: {
      title: input.title,
      note: input.note ?? null,
      dueDate: optionalDate(input.dueDate) ?? null,
      status: input.status,
      weekOf: weekOfFor(input.status),
    },
  });
  return toDto(task);
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDto | null> {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return null;
  const task = await prisma.task.update({
    where: { id },
    data: {
      title: input.title,
      note: input.note,
      dueDate: optionalDate(input.dueDate),
      ...(input.status !== undefined && { status: input.status, weekOf: weekOfFor(input.status) }),
    },
  });
  return toDto(task);
}

export async function deleteTask(id: string): Promise<TaskDto | null> {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return null;
  return toDto(await prisma.task.delete({ where: { id } }));
}
