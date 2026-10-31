import { Status } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "./db";
import { listProjects, type ProjectDto } from "./projects";
import { toDto, type TaskDto } from "./tasks";
import { TIMEZONE, shiftYmd, todayYmd, weekRange, ymdToDate, type WeekRange } from "./week";

export type ProjectTally = {
  projectId: string | null;
  name: string;
  color: string;
  planned: number;
  finished: number;
};

export type ReviewDto = {
  week: WeekRange;
  today: string;
  thisWeek: {
    planned: number;
    finished: number;
    inProgress: number;
    overdue: number;
    byProject: ProjectTally[];
  };
  carried: { task: TaskDto; rolloverCount: number }[];
  lastWeek: WeekRange & { planned: number; finished: number; carried: number; byProject: ProjectTally[] };
  perDay: { day: string; finished: number }[];
};

export type ReviewData = { tasks: TaskDto[]; projects: ProjectDto[] };

const NO_PROJECT = { name: "No project", color: "slate" };

function tallyByProject(planned: TaskDto[], isFinished: (t: TaskDto) => boolean, projects: ProjectDto[]) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const tallies = new Map<string | null, ProjectTally>();
  for (const task of planned) {
    const project = task.projectId ? byId.get(task.projectId) : undefined;
    const key = project ? project.id : null;
    const tally = tallies.get(key) ?? {
      projectId: key,
      name: project?.name ?? NO_PROJECT.name,
      color: project?.color ?? NO_PROJECT.color,
      planned: 0,
      finished: 0,
    };
    tally.planned += 1;
    if (isFinished(task)) tally.finished += 1;
    tallies.set(key, tally);
  }
  return [...tallies.values()].sort(
    (a, b) => Number(a.projectId === null) - Number(b.projectId === null) || a.name.localeCompare(b.name),
  );
}

function completedDay(task: TaskDto): string | null {
  return task.completedAt ? formatInTimeZone(new Date(task.completedAt), TIMEZONE, "yyyy-MM-dd") : null;
}

export function buildReview(now: Date, { tasks, projects }: ReviewData): ReviewDto {
  const week = weekRange(now);
  const today = todayYmd(now);
  const lastStart = shiftYmd(week.start, -7);
  const isDone = (t: TaskDto) => t.status === Status.DONE;

  const planned = tasks.filter((t) => t.weekOf === week.start);
  const carriedTasks = tasks.filter((t) => t.rolledBackAt === week.start);
  const lastFinished = tasks.filter((t) => t.archived && isDone(t) && t.weekOf === lastStart);
  const lastPlanned = [...lastFinished, ...carriedTasks];
  const finishedIds = new Set(lastFinished.map((t) => t.id));

  const days = Array.from({ length: 7 }, (_, i) => shiftYmd(today, i - 6));
  const finishedOn = new Map<string, number>();
  for (const task of tasks) {
    const day = completedDay(task);
    if (day) finishedOn.set(day, (finishedOn.get(day) ?? 0) + 1);
  }

  return {
    week,
    today,
    thisWeek: {
      planned: planned.length,
      finished: planned.filter(isDone).length,
      inProgress: planned.filter((t) => t.status === Status.IN_PROGRESS).length,
      overdue: tasks.filter((t) => !t.archived && !isDone(t) && t.dueDate !== null && t.dueDate < today).length,
      byProject: tallyByProject(planned, isDone, projects),
    },
    carried: carriedTasks.map((task) => ({ task, rolloverCount: task.rolloverCount })),
    lastWeek: {
      start: lastStart,
      end: shiftYmd(lastStart, 6),
      planned: lastPlanned.length,
      finished: lastFinished.length,
      carried: carriedTasks.length,
      byProject: tallyByProject(lastPlanned, (t) => finishedIds.has(t.id), projects),
    },
    perDay: days.map((day) => ({ day, finished: finishedOn.get(day) ?? 0 })),
  };
}

export async function getReview(now: Date = new Date()): Promise<ReviewDto> {
  const week = weekRange(now);
  const thisMonday = ymdToDate(week.start);
  const since = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [
          { weekOf: { in: [thisMonday, ymdToDate(shiftYmd(week.start, -7))] } },
          { rolledBackAt: thisMonday },
          { completedAt: { gte: since } },
          { archived: false, status: { not: Status.DONE }, dueDate: { lt: ymdToDate(todayYmd(now)) } },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    listProjects(),
  ]);
  return buildReview(now, { tasks: tasks.map(toDto), projects });
}
