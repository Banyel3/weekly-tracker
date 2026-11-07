import { Status, type Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { z, type AnyZodObject } from "zod";
import { CHECKLIST_MAX_ITEMS, CHECKLIST_TEXT_MAX, readChecklist, type ChecklistItem } from "../checklist";
import { WIP_LIMIT } from "../constants";
import { prisma } from "../db";
import { loadDigestData } from "../digest";
import { buildMorningDigest, digestSections, type DigestTask } from "../digestText";
import { isPrismaError } from "../http";
import { listProjects } from "../projects";
import { getReview } from "../review";
import { buildWeeklySummaryText } from "../summaryText";
import {
  createTask,
  createTaskSchema,
  deleteTask,
  listBoard,
  RestoreFirstError,
  sortColumn,
  toDto,
  updateTask,
  type TaskDto,
  type UpdateTaskInput,
} from "../tasks";
import { currentWeekStart, dateToYmd, shiftYmd, todayYmd, ymdToDate } from "../week";
import { dateInput, issuesToString, priorityInput, PRIORITY_NAMES, STATUS_NAMES, statusInput } from "./parse";
import { findOrCreateProjectByName, findProjectByName } from "./projects";

/** A failure the agent can act on: 400 for input it should change, 404 for an id or name that does not exist. */
export class AgentError extends Error {
  constructor(
    readonly status: 400 | 404,
    message: string,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

const notFound = (id: string) => new AgentError(404, `task not found: ${id}`);

export const LIST_LIMIT_MAX = 100;
export const LIST_LIMIT_DEFAULT = 50;
export const TASK_EVENTS_LIMIT = 20;
export const SNOOZE_DAYS_MAX = 60;

// ---- JSON Schema pieces (hand-written; the zod schema next to each tool validates the same shape) ----

type JsonSchema = Record<string, unknown>;
export type InputSchema = { type: "object"; properties: Record<string, JsonSchema>; required?: string[]; additionalProperties: false };

const DATE_HELP = "YYYY-MM-DD in Asia/Manila, or the words today / tomorrow";
const idProp: JsonSchema = { type: "string", description: "Task id, as returned by list_tasks, get_board or get_today" };
const statusProp: JsonSchema = { type: "string", enum: [...STATUS_NAMES], description: "Board column (case-insensitive)" };
const priorityProp: JsonSchema = { type: "string", enum: [...PRIORITY_NAMES], description: "Priority (case-insensitive)" };
const dateProp = (what: string): JsonSchema => ({ type: "string", description: `${what}: ${DATE_HELP}` });
const checklistProp: JsonSchema = {
  type: "array",
  items: { type: "string", minLength: 1, maxLength: CHECKLIST_TEXT_MAX },
  maxItems: CHECKLIST_MAX_ITEMS,
  description: `Checklist item texts, in order (at most ${CHECKLIST_MAX_ITEMS})`,
};

const objectSchema = (properties: Record<string, JsonSchema> = {}, required: string[] = []): InputSchema => ({
  type: "object",
  properties,
  ...(required.length > 0 && { required }),
  additionalProperties: false,
});

// ---- zod pieces ----

const idInput = z.string().trim().min(1).max(100);
const titleInput = z.string().trim().min(1).max(200);
const noteInput = z.string().max(2000);
const projectInput = z.string().trim().min(1).max(40);
const checklistInput = z.array(z.string().trim().min(1).max(CHECKLIST_TEXT_MAX)).max(CHECKLIST_MAX_ITEMS);
/** Arrays as documented; a single or comma-separated string is accepted too (REST query params map onto this). */
const statusListInput = z.preprocess(
  (v) => (typeof v === "string" ? v.split(",").filter((s) => s.trim() !== "") : v),
  z.array(statusInput).min(1).max(STATUS_NAMES.length),
);

// ---- tool registry ----

type ToolSpec = {
  name: string;
  description: string;
  input_schema: InputSchema;
  schema: (now: Date) => AnyZodObject;
  run: (input: never, now: Date) => Promise<unknown>;
};

function tool<S extends AnyZodObject>(spec: {
  name: string;
  description: string;
  input_schema: InputSchema;
  schema: (now: Date) => S;
  run: (input: z.output<S>, now: Date) => Promise<unknown>;
}): ToolSpec {
  return spec as ToolSpec;
}

const empty = () => z.object({}).strict();

async function existingTask(id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw notFound(id);
  return task;
}

export const LIST_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { dueDate: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" },
];

const byStatusThenColumn = (tasks: TaskDto[], weekStart: string) =>
  Object.values(Status).flatMap((status) =>
    sortColumn(
      tasks.filter((t) => t.status === status),
      weekStart,
    ),
  );

/** Same texts keep their id and done state, so rewriting a list does not untick finished items. */
export function mergeChecklist(texts: string[], existing: ChecklistItem[]) {
  const pool = [...existing];
  return texts.map((text) => {
    const i = pool.findIndex((item) => item.text === text);
    if (i < 0) return { text, done: false };
    const [kept] = pool.splice(i, 1);
    return { id: kept.id, text, done: kept.done };
  });
}

async function getToday(now: Date) {
  const data = await loadDigestData(now);
  const sections = digestSections(data);
  const ids = [...new Set(Object.values(sections).flat().map((t) => t.id))];
  const rows = ids.length === 0 ? [] : await prisma.task.findMany({ where: { id: { in: ids } }, take: ids.length });
  const byId = new Map(rows.map((row) => [row.id, toDto(row)]));
  const dtos = (list: DigestTask[]) => list.flatMap((t) => byId.get(t.id) ?? []);
  const day = ymdToDate(data.today);
  return {
    date: data.today,
    weekday: formatInTimeZone(day, "UTC", "EEEE"),
    dayIndex: Number(formatInTimeZone(day, "UTC", "i")),
    week: data.week,
    digest: buildMorningDigest(data),
    overdue: dtos(sections.overdue),
    dueToday: dtos(sections.dueToday),
    dueTomorrow: dtos(sections.dueTomorrow),
    laterThisWeek: dtos(sections.later),
    inProgress: data.inProgress,
    wipLimit: WIP_LIMIT,
    openThisWeek: data.openThisWeek,
    carried: data.carried,
  };
}

const TOOLS: ToolSpec[] = [
  tool({
    name: "get_today",
    description:
      "Today's briefing (Asia/Manila): date, weekday, the morning digest text, and the open tasks that are overdue, due today, due tomorrow or due later this week, plus in-progress count against the WIP limit and how many tasks are open or carried this week. Call this first when asked what is on today. Undated Backlog tasks are not included; to find a task by title use list_tasks with query.",
    input_schema: objectSchema(),
    schema: empty,
    run: (_input, now) => getToday(now),
  }),
  tool({
    name: "get_board",
    description:
      "The whole board for the current week: every Backlog task plus this week's This week, In progress and Done tasks (sorted per column), all projects, counts, and the ids of tasks carried back from last week.",
    input_schema: objectSchema(),
    schema: empty,
    run: (_input, now) => listBoard(now),
  }),
  tool({
    name: "list_tasks",
    description:
      "Search tasks with filters. Returns live (non-archived) tasks unless archived is true. When more tasks match than limit, you get the soonest-due ones (undated last, then oldest first). Results are grouped by column and sorted the way the board sorts them (priority, due date, age).",
    input_schema: objectSchema({
      status: { type: "array", items: statusProp, minItems: 1, description: "Only these columns" },
      project: { type: "string", description: "Project name (case-insensitive exact match)" },
      due_from: dateProp("Due on or after"),
      due_to: dateProp("Due on or before"),
      query: { type: "string", description: "Text the title or note contains (case-insensitive)" },
      archived: { type: "boolean", description: "Search archived tasks instead of live ones (default false)" },
      limit: { type: "integer", minimum: 1, maximum: LIST_LIMIT_MAX, description: `Maximum tasks (default ${LIST_LIMIT_DEFAULT})` },
    }),
    schema: (now) =>
      z
        .object({
          status: statusListInput.optional(),
          project: projectInput.optional(),
          due_from: dateInput(now).optional(),
          due_to: dateInput(now).optional(),
          query: z.string().trim().min(1).max(200).optional(),
          archived: z.boolean().optional(),
          limit: z.number().int().min(1).max(LIST_LIMIT_MAX).optional(),
        })
        .strict(),
    run: async (input, now) => {
      if (input.due_from && input.due_to && input.due_from > input.due_to) {
        throw new AgentError(400, "due_from must not be after due_to");
      }
      let projectId: string | undefined;
      if (input.project) {
        const project = await findProjectByName(input.project);
        if (!project) throw new AgentError(404, `project not found: ${input.project}`);
        projectId = project.id;
      }
      const where: Prisma.TaskWhereInput = {
        archived: input.archived ?? false,
        ...(input.status && { status: { in: input.status } }),
        ...(projectId && { projectId }),
        ...((input.due_from || input.due_to) && {
          dueDate: {
            ...(input.due_from && { gte: ymdToDate(input.due_from) }),
            ...(input.due_to && { lte: ymdToDate(input.due_to) }),
          },
        }),
        ...(input.query && {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { note: { contains: input.query, mode: "insensitive" } },
          ],
        }),
      };
      const rows = await prisma.task.findMany({
        where,
        // Priority is an enum Postgres cannot rank like the board, so the page is the soonest-due N; sortColumn orders it.
        orderBy: LIST_ORDER,
        take: input.limit ?? LIST_LIMIT_DEFAULT,
      });
      return { tasks: byStatusThenColumn(rows.map(toDto), currentWeekStart(now)) };
    },
  }),
  tool({
    name: "get_task",
    description: `One task by id with its latest ${TASK_EVENTS_LIMIT} history events (newest first).`,
    input_schema: objectSchema({ id: idProp }, ["id"]),
    schema: () => z.object({ id: idInput }).strict(),
    run: async ({ id }) => {
      const task = await existingTask(id);
      const events = await prisma.taskEvent.findMany({
        where: { taskId: id },
        orderBy: { at: "desc" },
        take: TASK_EVENTS_LIMIT,
        select: { type: true, at: true, from: true, to: true },
      });
      return { task: toDto(task), events: events.map((e) => ({ ...e, at: e.at.toISOString() })) };
    },
  }),
  tool({
    name: "create_task",
    description:
      "Create a task. Status defaults to backlog; this_week, in_progress or done plan it into the current week. A project name that does not exist yet is created with the next free colour. Due dates are dates only (YYYY-MM-DD, Asia/Manila); the board stores no time of day, so do not promise one.",
    input_schema: objectSchema(
      {
        title: { type: "string", minLength: 1, maxLength: 200, description: "Task title" },
        note: { type: "string", maxLength: 2000, description: "Longer note" },
        due: dateProp("Due date"),
        priority: priorityProp,
        status: { ...statusProp, description: "Board column (default backlog)" },
        project: { type: "string", maxLength: 40, description: "Project name (case-insensitive; created if missing)" },
        checklist: checklistProp,
      },
      ["title"],
    ),
    schema: (now) =>
      z
        .object({
          title: titleInput,
          note: noteInput.optional(),
          due: dateInput(now).optional(),
          priority: priorityInput.optional(),
          status: statusInput.optional(),
          project: projectInput.optional(),
          checklist: checklistInput.optional(),
        })
        .strict(),
    run: async (input) => {
      const project = input.project ? await findOrCreateProjectByName(input.project) : null;
      const parsed = createTaskSchema.safeParse({
          title: input.title,
          note: input.note ?? null,
          dueDate: input.due ?? null,
          priority: input.priority,
          status: input.status,
          projectId: project?.id ?? null,
          checklist: (input.checklist ?? []).map((text) => ({ text })),
      });
      // The agent schema mirrors createTaskSchema; if they ever drift, answer 400 rather than 500.
      if (!parsed.success) throw new AgentError(400, issuesToString(parsed.error));
      return { task: await createTask(parsed.data) };
    },
  }),
  tool({
    name: "update_task",
    description:
      "Edit a task's fields. Only the fields you pass change; null clears note, due or project. checklist replaces the whole list (items whose text is unchanged keep their ticked state). Use move_task to change the column. Take the id from a get_task or list_tasks result in this conversation; ids from older messages may be stale. Due dates are dates only (YYYY-MM-DD, Asia/Manila); the board stores no time of day, so do not promise one.",
    input_schema: objectSchema(
      {
        id: idProp,
        title: { type: "string", minLength: 1, maxLength: 200, description: "New title" },
        note: { type: ["string", "null"], maxLength: 2000, description: "New note, or null to clear" },
        due: { type: ["string", "null"], description: `New due date (${DATE_HELP}), or null to clear` },
        priority: priorityProp,
        project: { type: ["string", "null"], maxLength: 40, description: "Project name (created if missing), or null to clear" },
        checklist: checklistProp,
      },
      ["id"],
    ),
    schema: (now) =>
      z
        .object({
          id: idInput,
          title: titleInput.optional(),
          note: noteInput.nullable().optional(),
          due: dateInput(now).nullable().optional(),
          priority: priorityInput.optional(),
          project: projectInput.nullable().optional(),
          checklist: checklistInput.optional(),
        })
        .strict(),
    run: async ({ id, ...fields }) => {
      if (Object.values(fields).every((v) => v === undefined)) {
        throw new AgentError(400, "nothing to update: pass title, note, due, priority, project or checklist");
      }
      const existing = await existingTask(id);
      const patch: UpdateTaskInput = {
        title: fields.title,
        note: fields.note,
        dueDate: fields.due,
        priority: fields.priority,
      };
      if (fields.project !== undefined) {
        patch.projectId = fields.project === null ? null : (await findOrCreateProjectByName(fields.project)).id;
      }
      if (fields.checklist !== undefined) {
        patch.checklist = mergeChecklist(fields.checklist, readChecklist(existing.checklist));
      }
      const task = await updateTask(id, patch);
      if (!task) throw notFound(id);
      return { task };
    },
  }),
  tool({
    name: "move_task",
    description:
      "Move a task to another column. this_week, in_progress and done plan it into the current week; done records the completion time; backlog unplans it. Archived tasks must be restored first (restore_task). Take the id from a get_task or list_tasks result in this conversation; ids from older messages may be stale.",
    input_schema: objectSchema({ id: idProp, status: statusProp }, ["id", "status"]),
    schema: () => z.object({ id: idInput, status: statusInput }).strict(),
    run: async ({ id, status }) => {
      const task = await updateTask(id, { status });
      if (!task) throw notFound(id);
      return { task };
    },
  }),
  tool({
    name: "snooze_task",
    description: `Push a task's due date. With until, the due date becomes that day. Otherwise it moves days ahead (default 1, at most ${SNOOZE_DAYS_MAX}) from the later of today and the current due date, so an overdue task lands days after today. Pass days or until, not both; until must not be before today. Take the id from a get_task or list_tasks result in this conversation; ids from older messages may be stale. Due dates are dates only (YYYY-MM-DD, Asia/Manila); the board stores no time of day, so do not promise one.`,
    input_schema: objectSchema(
      {
        id: idProp,
        days: { type: "integer", minimum: 1, maximum: SNOOZE_DAYS_MAX, description: "Days to push (default 1)" },
        until: dateProp("New due date"),
      },
      ["id"],
    ),
    schema: (now) =>
      z
        .object({
          id: idInput,
          days: z.number().int().min(1).max(SNOOZE_DAYS_MAX).optional(),
          until: dateInput(now).optional(),
        })
        .strict(),
    run: async ({ id, days, until }, now) => {
      if (days !== undefined && until !== undefined) throw new AgentError(400, "pass days or until, not both");
      const today = todayYmd(now);
      if (until !== undefined && until < today) throw new AgentError(400, `until is before today (${today})`);
      const existing = await existingTask(id);
      const current = existing.dueDate ? dateToYmd(existing.dueDate) : null;
      const base = current !== null && current > today ? current : today;
      const task = await updateTask(id, { dueDate: until ?? shiftYmd(base, days ?? 1) });
      if (!task) throw notFound(id);
      return { task };
    },
  }),
  tool({
    name: "delete_task",
    description: "Delete a task permanently. Its history stays for the weekly stats. Prefer move_task to done for finished work. Take the id from a get_task or list_tasks result in this conversation; ids from older messages may be stale.",
    input_schema: objectSchema({ id: idProp }, ["id"]),
    schema: () => z.object({ id: idInput }).strict(),
    run: async ({ id }) => {
      if (!(await deleteTask(id))) throw notFound(id);
      return { deleted: true };
    },
  }),
  tool({
    name: "restore_task",
    description: "Bring an archived task back onto the board, into backlog by default or into the column you pass. Take the id from a get_task or list_tasks result in this conversation; ids from older messages may be stale.",
    input_schema: objectSchema({ id: idProp, status: { ...statusProp, description: "Column to restore into (default backlog)" } }, ["id"]),
    schema: () => z.object({ id: idInput, status: statusInput.optional() }).strict(),
    run: async ({ id, status }) => {
      const existing = await existingTask(id);
      if (!existing.archived) throw new AgentError(400, "task is not archived");
      // A restore always lands in Backlog (updateData); a different column is a second, ordinary move.
      let task = await updateTask(id, { archived: false });
      if (task && status !== undefined && status !== Status.BACKLOG) task = await updateTask(id, { status });
      if (!task) throw notFound(id);
      return { task };
    },
  }),
  tool({
    name: "get_review",
    description:
      "The weekly review: this week's planned vs finished by project, carried-over tasks, last week's numbers, finishes per day, insights, and a short plain-text summary.",
    input_schema: objectSchema(),
    schema: empty,
    run: async (_input, now) => {
      const review = await getReview(now);
      return { review, summary: buildWeeklySummaryText(review) };
    },
  }),
  tool({
    name: "list_projects",
    description: "All projects (id, name, colour), sorted by name.",
    input_schema: objectSchema(),
    schema: empty,
    run: async () => ({ projects: await listProjects() }),
  }),
];

const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export type AgentToolDefinition = Pick<ToolSpec, "name" | "description" | "input_schema">;

/** Anthropic Messages API tool definitions, ready for its `tools` parameter. */
export const AGENT_TOOLS: AgentToolDefinition[] = TOOLS.map(({ name, description, input_schema }) => ({
  name,
  description,
  input_schema,
}));

/** The zod schema runTool validates a tool's input with; undefined for an unknown name. */
export function toolInputSchema(name: string, now: Date = new Date()): AnyZodObject | undefined {
  return TOOLS_BY_NAME.get(name)?.schema(now);
}

export type ToolOutcome = { ok: true; result: unknown } | { ok: false; status: 400 | 404; error: string };

/**
 * The single entry point for every agent route. `now` drives date sugar and the week/today reads;
 * writes keep their own clock inside createTask/updateTask/deleteTask. Unexpected errors propagate (500).
 */
export async function runTool(name: string, input: unknown, now: Date = new Date()): Promise<ToolOutcome> {
  const spec = TOOLS_BY_NAME.get(name);
  if (!spec) return { ok: false, status: 404, error: `unknown tool: ${name}` };
  const parsed = spec.schema(now).safeParse(input ?? {});
  if (!parsed.success) return { ok: false, status: 400, error: issuesToString(parsed.error) };
  try {
    return { ok: true, result: await spec.run(parsed.data as never, now) };
  } catch (e) {
    if (e instanceof AgentError) return { ok: false, status: e.status, error: e.message };
    if (e instanceof RestoreFirstError) return { ok: false, status: 400, error: e.message };
    if (isPrismaError(e, "P2003")) return { ok: false, status: 400, error: "unknown project" };
    throw e;
  }
}

/** `/run` wraps results as `{ ok, result }`; REST routes return the bare result and `{ error }`. */
export function toolResponse(outcome: ToolOutcome, { envelope = true }: { envelope?: boolean } = {}): Response {
  if (outcome.ok) return Response.json(envelope ? { ok: true, result: outcome.result } : outcome.result);
  return Response.json(envelope ? { ok: false, error: outcome.error } : { error: outcome.error }, { status: outcome.status });
}
