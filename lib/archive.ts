import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { toDto, type TaskDto } from "./tasks";
import { dateToYmd, weekRange, ymdToDate } from "./week";

export const archiveQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(52).default(8),
});

export type ArchiveQuery = z.infer<typeof archiveQuerySchema>;

export type ArchiveWeek = { start: string; end: string; tasks: TaskDto[] };

export type ArchiveDto = { weeks: ArchiveWeek[]; nextBefore: string | null };

export async function listArchive({ q, before, limit }: ArchiveQuery): Promise<ArchiveDto> {
  const where: Prisma.TaskWhereInput = {
    archived: true,
    weekOf: before ? { lt: ymdToDate(before) } : { not: null },
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const groups = await prisma.task.groupBy({
    by: ["weekOf"],
    where,
    orderBy: { weekOf: "desc" },
    take: limit + 1,
  });
  const starts = groups.slice(0, limit).flatMap((g) => (g.weekOf ? [g.weekOf] : []));
  if (starts.length === 0) return { weeks: [], nextBefore: null };

  const tasks = await prisma.task.findMany({
    where: { ...where, weekOf: { in: starts } },
    orderBy: [{ weekOf: "desc" }, { completedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  const weeks = starts.map((start) => ({
    ...weekRange(start),
    tasks: tasks.filter((t) => t.weekOf?.getTime() === start.getTime()).map(toDto),
  }));
  const nextBefore = groups.length > limit ? dateToYmd(starts[starts.length - 1]) : null;
  return { weeks, nextBefore };
}
