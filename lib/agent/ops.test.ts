import type { Task } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, type ZodTypeAny } from "zod";

const { prisma, tx, getReview } = vi.hoisted(() => {
  const tx = {
    task: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    taskEvent: { createMany: vi.fn() },
  };
  const prisma = {
    task: { findUnique: vi.fn(), findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    project: { findMany: vi.fn(async () => []), findFirst: vi.fn(), create: vi.fn() },
    taskEvent: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { prisma, tx, getReview: vi.fn() };
});

vi.mock("../db", () => ({ prisma }));
vi.mock("../review", () => ({ getReview }));

import { createTaskSchema } from "../tasks";
import { AGENT_TOOLS, LIST_ORDER, mergeChecklist, runTool, toolInputSchema, toolResponse } from "./ops";

// Wed 2026-11-04 10:00 Manila.
const NOW = new Date("2026-11-04T02:00:00.000Z");
const d = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

const row = (over: Partial<Task> = {}) =>
  ({
    id: "t1",
    title: "Write the brief",
    note: null,
    dueDate: null,
    status: "THIS_WEEK",
    weekOf: d("2026-11-02"),
    rolledBackAt: null,
    projectId: null,
    priority: "NONE",
    checklist: [],
    rolloverCount: 0,
    completedAt: null,
    archived: false,
    createdAt: new Date("2026-11-02T01:00:00.000Z"),
    updatedAt: new Date("2026-11-02T01:00:00.000Z"),
    ...over,
  }) as Task;

const defined = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

/** Point both reads of updateTask (and the tool's own pre-read) at one row, and echo updates onto it. */
function withTask(task: Task | null) {
  let current = task;
  prisma.task.findUnique.mockImplementation(async () => current);
  tx.task.findUnique.mockImplementation(async () => current);
  tx.task.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    current = { ...current, ...defined(data) } as Task;
    return current;
  });
  tx.task.delete.mockImplementation(async () => current);
}

const ok = async (name: string, input: unknown = {}) => {
  const outcome = await runTool(name, input, NOW);
  if (!outcome.ok) throw new Error(`${name} failed: ${outcome.error}`);
  return outcome.result as Record<string, any>;
};

const fails = async (name: string, input: unknown, status: number, error?: string | RegExp) => {
  const outcome = await runTool(name, input, NOW);
  expect(outcome.ok).toBe(false);
  if (outcome.ok) return;
  expect(outcome.status).toBe(status);
  if (typeof error === "string") expect(outcome.error).toBe(error);
  else if (error) expect(outcome.error).toMatch(error);
};

const eventTypes = () =>
  tx.taskEvent.createMany.mock.calls.flatMap((c) => c[0].data.map((e: { type: string }) => e.type));

beforeEach(() => {
  vi.clearAllMocks();
  prisma.task.findMany.mockImplementation(async () => []);
  prisma.taskEvent.findMany.mockImplementation(async () => []);
  prisma.project.findMany.mockImplementation(async () => []);
});

/** One documented example per tool; also the inputs docs/agent-api.md shows. */
const EXAMPLES: Record<string, unknown[]> = {
  get_today: [{}],
  get_board: [{}],
  list_tasks: [{}, { status: ["this_week", "in_progress"], project: "Work", due_to: "tomorrow", limit: 20 }, { query: "brief", archived: true }],
  get_task: [{ id: "t1" }],
  create_task: [
    { title: "Call the bank" },
    { title: "Ship v2", note: "after QA", due: "2026-11-06", priority: "high", status: "this_week", project: "Work", checklist: ["QA", "Deploy"] },
  ],
  update_task: [{ id: "t1", due: null, project: null }, { id: "t1", title: "New title", priority: "urgent", checklist: ["a"] }],
  move_task: [{ id: "t1", status: "done" }, { id: "t1", status: "In Progress" }],
  snooze_task: [{ id: "t1" }, { id: "t1", days: 3 }, { id: "t1", until: "tomorrow" }],
  delete_task: [{ id: "t1" }],
  restore_task: [{ id: "t1" }, { id: "t1", status: "this_week" }],
  get_review: [{}],
  list_projects: [{}],
};

describe("AGENT_TOOLS", () => {
  it("lists the 12 tools in order", () => {
    expect(AGENT_TOOLS.map((t) => t.name)).toEqual(Object.keys(EXAMPLES));
  });

  it.each(AGENT_TOOLS.map((t) => [t.name, t] as const))("%s has a valid input_schema matching its zod schema", (name, def) => {
    expect(def.description.length).toBeGreaterThan(20);
    expect(Object.keys(def)).toEqual(["name", "description", "input_schema"]);
    const schema = def.input_schema;
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(typeof schema.properties).toBe("object");
    for (const prop of Object.values(schema.properties)) {
      expect("type" in prop || "enum" in prop).toBe(true);
      expect(typeof prop.description).toBe("string");
    }
    const shape = toolInputSchema(name, NOW)!.shape as Record<string, ZodTypeAny>;
    expect(Object.keys(schema.properties).sort()).toEqual(Object.keys(shape).sort());
    const zodRequired = Object.keys(shape).filter((key) => !shape[key].isOptional());
    expect([...(schema.required ?? [])].sort()).toEqual(zodRequired.sort());
    if (schema.required) expect(schema.required.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(EXAMPLES))("%s examples parse with the zod schema", (name, examples) => {
    for (const example of examples) {
      const result = toolInputSchema(name, NOW)!.safeParse(example);
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it("serialises to plain JSON", () => {
    expect(JSON.parse(JSON.stringify(AGENT_TOOLS))).toEqual(AGENT_TOOLS);
  });
});

describe("runTool", () => {
  it("returns 404 for an unknown tool", async () => {
    await fails("make_coffee", {}, 404, "unknown tool: make_coffee");
  });

  it("rejects unknown keys so typos surface", async () => {
    await fails("get_task", { id: "t1", dueDate: "2026-11-05" }, 400, /Unrecognized key/);
  });

  it("treats a missing input as {}", async () => {
    prisma.project.findMany.mockResolvedValue([]);
    expect((await runTool("list_projects", undefined, NOW)).ok).toBe(true);
  });

  it("lets unexpected errors propagate", async () => {
    prisma.project.findMany.mockRejectedValue(new Error("db down"));
    await expect(runTool("list_projects", {}, NOW)).rejects.toThrow("db down");
  });
});

describe("get_today", () => {
  it("returns the digest, sections as TaskDtos and counts", async () => {
    const open = [
      { id: "late", title: "Late", dueDate: d("2026-11-02"), status: "THIS_WEEK", priority: "NONE", weekOf: d("2026-11-02"), createdAt: d("2026-11-01"), project: null },
      { id: "now", title: "Now", dueDate: d("2026-11-04"), status: "IN_PROGRESS", priority: "HIGH", weekOf: d("2026-11-02"), createdAt: d("2026-11-01"), project: { name: "Work" } },
      { id: "tmr", title: "Tmr", dueDate: d("2026-11-05"), status: "BACKLOG", priority: "NONE", weekOf: null, createdAt: d("2026-11-01"), project: null },
      { id: "fri", title: "Fri", dueDate: d("2026-11-06"), status: "BACKLOG", priority: "NONE", weekOf: null, createdAt: d("2026-11-01"), project: null },
      { id: "undated", title: "Undated", dueDate: null, status: "BACKLOG", priority: "NONE", weekOf: null, createdAt: d("2026-11-01"), project: null },
    ];
    prisma.task.findMany.mockImplementation((async (args: any) => {
      if (args.select) return open;
      return open
        .filter((t) => args.where.id.in.includes(t.id))
        .map((t) => row({ id: t.id, title: t.title, dueDate: t.dueDate, status: t.status as Task["status"] }));
    }) as any);
    const today = await ok("get_today");
    expect(today).toMatchObject({ date: "2026-11-04", weekday: "Wednesday", dayIndex: 3, week: { start: "2026-11-02", end: "2026-11-08" } });
    expect(today.digest).toMatch(/^Good morning · Wed Nov 4 · day 3 of 7/);
    expect(today.overdue.map((t: any) => t.id)).toEqual(["late"]);
    expect(today.dueToday[0]).toMatchObject({ id: "now", dueDate: "2026-11-04" });
    expect(today.dueTomorrow.map((t: any) => t.id)).toEqual(["tmr"]);
    expect(today.laterThisWeek.map((t: any) => t.id)).toEqual(["fri"]);
    expect(today).toMatchObject({ inProgress: 1, wipLimit: 3, openThisWeek: 2, carried: 0 });
    const idQuery = (prisma.task.findMany.mock.calls as unknown as any[][]).find((c) => !c[0].select)![0];
    expect(idQuery.take).toBe(4);
  });

  it("skips the id query on a quiet day", async () => {
    const today = await ok("get_today");
    expect(today.overdue).toEqual([]);
    expect(today.digest).toContain("Nothing planned this week");
    expect(prisma.task.findMany).toHaveBeenCalledTimes(1);
  });

  it("rejects input keys", async () => {
    await fails("get_today", { date: "today" }, 400);
  });
});

describe("get_board", () => {
  it("returns listBoard with projects", async () => {
    prisma.project.findMany.mockResolvedValue([{ id: "p1", name: "Work", color: "sky" }] as never);
    prisma.task.findMany.mockResolvedValue([row()] as never);
    const board = await ok("get_board");
    expect(board.week).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(board.projects).toEqual([{ id: "p1", name: "Work", color: "sky" }]);
    expect(board.tasks.map((t: any) => t.id)).toEqual(["t1"]);
  });

  it("rejects input keys", async () => {
    await fails("get_board", { week: "next" }, 400);
  });
});

describe("list_tasks", () => {
  it("defaults to live tasks, 50 at most", async () => {
    await ok("list_tasks");
    expect(prisma.task.findMany).toHaveBeenCalledWith({ where: { archived: false }, orderBy: LIST_ORDER, take: 50 });
  });

  it("builds every filter", async () => {
    prisma.project.findFirst.mockResolvedValue({ id: "p1", name: "Work", color: "sky" });
    await ok("list_tasks", { status: ["This_Week", "done"], project: "work", due_from: "today", due_to: "2026-11-30", query: "brief", archived: true, limit: 100 });
    expect(prisma.task.findMany).toHaveBeenCalledWith({
      where: {
        archived: true,
        status: { in: ["THIS_WEEK", "DONE"] },
        projectId: "p1",
        dueDate: { gte: d("2026-11-04"), lte: d("2026-11-30") },
        OR: [
          { title: { contains: "brief", mode: "insensitive" } },
          { note: { contains: "brief", mode: "insensitive" } },
        ],
      },
      orderBy: LIST_ORDER,
      take: 100,
    });
  });

  it("pages by soonest due date, undated last, then age", async () => {
    await ok("list_tasks", { limit: 2 });
    expect(LIST_ORDER).toEqual([{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]);
    expect((prisma.task.findMany.mock.calls[0] as any)[0]).toMatchObject({ orderBy: LIST_ORDER, take: 2 });
    expect(AGENT_TOOLS.find((t) => t.name === "list_tasks")!.description).toContain("soonest-due");
  });

  it("accepts a comma-separated status string", async () => {
    await ok("list_tasks", { status: "backlog,in_progress" });
    expect((prisma.task.findMany.mock.calls[0] as any)[0].where.status).toEqual({ in: ["BACKLOG", "IN_PROGRESS"] });
  });

  it("groups by column and sorts like the board", async () => {
    prisma.task.findMany.mockResolvedValue([
      row({ id: "done", status: "DONE" }),
      row({ id: "plain", status: "BACKLOG", weekOf: null }),
      row({ id: "urgent", status: "BACKLOG", weekOf: null, priority: "URGENT", createdAt: new Date("2026-11-03T00:00:00Z") }),
    ] as never);
    const { tasks } = await ok("list_tasks");
    expect(tasks.map((t: any) => t.id)).toEqual(["urgent", "plain", "done"]);
  });

  it("rejects a limit over 100", async () => {
    await fails("list_tasks", { limit: 101 }, 400, /^limit: /);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it("rejects a bad status string", async () => {
    await fails("list_tasks", { status: ["doing"] }, 400, "status.0: status must be one of backlog, this_week, in_progress, done");
  });

  it("rejects an inverted due range", async () => {
    await fails("list_tasks", { due_from: "2026-11-10", due_to: "2026-11-01" }, 400, "due_from must not be after due_to");
  });

  it("returns 404 for an unknown project", async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await fails("list_tasks", { project: "Nope" }, 404, "project not found: Nope");
  });
});

describe("get_task", () => {
  it("returns the task and its last 20 events", async () => {
    withTask(row());
    prisma.taskEvent.findMany.mockResolvedValue([{ type: "PLANNED", at: new Date("2026-11-02T01:00:00Z"), from: "BACKLOG", to: "THIS_WEEK" }] as never);
    const result = await ok("get_task", { id: "t1" });
    expect(result.task.id).toBe("t1");
    expect(result.events).toEqual([{ type: "PLANNED", at: "2026-11-02T01:00:00.000Z", from: "BACKLOG", to: "THIS_WEEK" }]);
    expect(prisma.taskEvent.findMany).toHaveBeenCalledWith({
      where: { taskId: "t1" },
      orderBy: { at: "desc" },
      take: 20,
      select: { type: true, at: true, from: true, to: true },
    });
  });

  it("returns 404 for an unknown id", async () => {
    withTask(null);
    await fails("get_task", { id: "nope" }, 404, "task not found: nope");
  });
});

describe("create_task", () => {
  beforeEach(() => {
    tx.task.create.mockImplementation(async ({ data }: any) => row({ id: "new", ...data }));
  });

  it("creates with defaults", async () => {
    const { task } = await ok("create_task", { title: "  Call the bank " });
    expect(task).toMatchObject({ id: "new", title: "Call the bank", status: "BACKLOG", priority: "NONE", dueDate: null, projectId: null });
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
    expect(eventTypes()).toEqual(["CREATED"]);
  });

  it("maps sugar, creates the project and the checklist", async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    prisma.project.findMany.mockResolvedValue([{ color: "rose" }] as never);
    prisma.project.create.mockImplementation(async ({ data }: any) => ({ id: "p2", ...data }));
    const { task } = await ok("create_task", { title: "Ship", due: "tomorrow", priority: "High", status: "this week", project: "Work", checklist: ["QA", " Deploy "] });
    const data = tx.task.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ dueDate: d("2026-11-05"), priority: "HIGH", status: "THIS_WEEK", projectId: "p2" });
    expect(data.checklist.map((i: any) => [i.text, i.done])).toEqual([["QA", false], ["Deploy", false]]);
    expect(prisma.project.create).toHaveBeenCalledWith({ data: { name: "Work", color: "amber" } });
    expect(task.projectId).toBe("p2");
    expect(eventTypes()).toEqual(["CREATED", "PLANNED"]);
  });

  it("requires a title", async () => {
    await fails("create_task", { note: "x" }, 400, "title: Required");
  });

  it("rejects a bad date", async () => {
    await fails("create_task", { title: "x", due: "next friday" }, 400, "due: must be YYYY-MM-DD, today or tomorrow");
    expect(tx.task.create).not.toHaveBeenCalled();
  });

  it("answers 400, not 500, if createTaskSchema rejects what the agent schema accepted", async () => {
    vi.spyOn(createTaskSchema, "safeParse").mockReturnValueOnce(z.object({ title: z.string().max(3) }).safeParse({ title: "long" }) as never);
    await fails("create_task", { title: "long" }, 400, /^title: /);
    expect(tx.task.create).not.toHaveBeenCalled();
  });

  it("caps the checklist at 20", async () => {
    await fails("create_task", { title: "x", checklist: Array.from({ length: 21 }, (_, i) => `i${i}`) }, 400, /^checklist: /);
  });
});

describe("update_task", () => {
  it("clears due and project, keeps unspecified fields", async () => {
    withTask(row({ dueDate: d("2026-11-06"), projectId: "p1", note: "keep" }));
    const { task } = await ok("update_task", { id: "t1", due: null, project: null });
    expect(tx.task.update.mock.calls[0][0].data).toMatchObject({ dueDate: null, projectId: null });
    expect(tx.task.update.mock.calls[0][0].data.note).toBeUndefined();
    expect(task).toMatchObject({ dueDate: null, projectId: null, note: "keep" });
    expect(eventTypes()).toEqual(["RESCHEDULED"]);
  });

  it("resolves a project name and keeps ticked checklist items", async () => {
    withTask(row({ checklist: [{ id: "c1", text: "QA", done: true }, { id: "c2", text: "Old", done: false }] }));
    prisma.project.findFirst.mockResolvedValue({ id: "p1", name: "Work", color: "sky" });
    const { task } = await ok("update_task", { id: "t1", project: "WORK", checklist: ["QA", "Deploy"], priority: "urgent" });
    expect(task.projectId).toBe("p1");
    expect(task.priority).toBe("URGENT");
    expect(task.checklist[0]).toEqual({ id: "c1", text: "QA", done: true });
    expect(task.checklist[1]).toMatchObject({ text: "Deploy", done: false });
    expect(task.checklist).toHaveLength(2);
  });

  it("returns 404 for an unknown id before touching projects", async () => {
    withTask(null);
    await fails("update_task", { id: "nope", project: "New" }, 404, "task not found: nope");
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("rejects an empty patch", async () => {
    await fails("update_task", { id: "t1" }, 400, /^nothing to update/);
  });

  it("points status changes at move_task", async () => {
    await fails("update_task", { id: "t1", status: "done" }, 400, /Unrecognized key/);
  });
});

describe("mergeChecklist", () => {
  it("matches duplicate texts one to one", () => {
    const merged = mergeChecklist(["a", "a", "b"], [{ id: "1", text: "a", done: true }]);
    expect(merged).toEqual([{ id: "1", text: "a", done: true }, { text: "a", done: false }, { text: "b", done: false }]);
  });
});

describe("move_task", () => {
  it("done sets completedAt through updateTask", async () => {
    withTask(row({ status: "IN_PROGRESS" }));
    const { task } = await ok("move_task", { id: "t1", status: "DONE" });
    expect(task.status).toBe("DONE");
    expect(task.completedAt).not.toBeNull();
    expect(eventTypes()).toEqual(["DONE"]);
  });

  it("rejects a bad status string", async () => {
    await fails("move_task", { id: "t1", status: "finished" }, 400, /^status: status must be one of/);
  });

  it("returns 400 for an archived task", async () => {
    withTask(row({ archived: true, status: "DONE" }));
    await fails("move_task", { id: "t1", status: "this_week" }, 400, "restore the task before changing its status");
  });

  it("returns 404 for an unknown id", async () => {
    withTask(null);
    await fails("move_task", { id: "nope", status: "done" }, 404);
  });
});

describe("snooze_task", () => {
  const dueAfter = async (dueDate: Date | null, input: Record<string, unknown>) => {
    withTask(row({ dueDate }));
    const { task } = await ok("snooze_task", { id: "t1", ...input });
    return task.dueDate;
  };

  it("counts days from today for an overdue task", async () => {
    expect(await dueAfter(d("2026-10-30"), { days: 2 })).toBe("2026-11-06");
  });

  it("defaults to one day, from today when undated", async () => {
    expect(await dueAfter(null, {})).toBe("2026-11-05");
  });

  it("counts from a future due date", async () => {
    expect(await dueAfter(d("2026-11-10"), { days: 3 })).toBe("2026-11-13");
  });

  it("sets until directly", async () => {
    expect(await dueAfter(d("2026-11-01"), { until: "2026-11-20" })).toBe("2026-11-20");
    expect(eventTypes()).toEqual(["RESCHEDULED"]);
  });

  it("rejects days and until together", async () => {
    await fails("snooze_task", { id: "t1", days: 1, until: "tomorrow" }, 400, "pass days or until, not both");
  });

  it("rejects until before today", async () => {
    await fails("snooze_task", { id: "t1", until: "2026-11-03" }, 400, "until is before today (2026-11-04)");
    expect(AGENT_TOOLS.find((t) => t.name === "snooze_task")!.description).toContain("until must not be before today");
  });

  it("rejects days over 60", async () => {
    await fails("snooze_task", { id: "t1", days: 61 }, 400, /^days: /);
  });

  it("returns 404 for an unknown id", async () => {
    withTask(null);
    await fails("snooze_task", { id: "nope" }, 404);
  });
});

describe("delete_task", () => {
  it("deletes and records the event", async () => {
    withTask(row());
    expect(await ok("delete_task", { id: "t1" })).toEqual({ deleted: true });
    expect(tx.task.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(eventTypes()).toEqual(["DELETED"]);
  });

  it("returns 404 for an unknown id", async () => {
    withTask(null);
    await fails("delete_task", { id: "nope" }, 404, "task not found: nope");
  });
});

describe("restore_task", () => {
  it("restores into backlog by default", async () => {
    withTask(row({ archived: true, status: "DONE", completedAt: new Date() }));
    const { task } = await ok("restore_task", { id: "t1" });
    expect(task).toMatchObject({ archived: false, status: "BACKLOG", completedAt: null });
    expect(tx.task.update).toHaveBeenCalledTimes(1);
    expect(eventTypes()).toEqual(["RESTORED"]);
  });

  it("restores then moves into the requested column", async () => {
    withTask(row({ archived: true, status: "DONE" }));
    const { task } = await ok("restore_task", { id: "t1", status: "this_week" });
    expect(task).toMatchObject({ archived: false, status: "THIS_WEEK", weekOf: "2026-11-02" });
    expect(eventTypes()).toEqual(["RESTORED", "PLANNED"]);
  });

  it("rejects a live task", async () => {
    withTask(row());
    await fails("restore_task", { id: "t1" }, 400, "task is not archived");
  });

  it("returns 404 for an unknown id", async () => {
    withTask(null);
    await fails("restore_task", { id: "nope" }, 404);
  });
});

describe("get_review", () => {
  it("returns the review and its summary text", async () => {
    const review = {
      week: { start: "2026-11-02", end: "2026-11-08" },
      thisWeek: { planned: 4, finished: 1, inProgress: 2, overdue: 0, byProject: [] },
      carried: [],
      insights: { origin: { carriedIn: 1, finishedCarried: 0, addedThisWeek: 3, finishedNew: 1 } },
    };
    getReview.mockResolvedValue(review);
    const result = await ok("get_review");
    expect(getReview).toHaveBeenCalledWith(NOW);
    expect(result.review).toBe(review);
    expect(result.summary).toMatch(/^Week of Nov 2: finished 1 of 4/);
  });

  it("rejects input keys", async () => {
    await fails("get_review", { week: "last" }, 400);
  });
});

describe("list_projects", () => {
  it("returns projects", async () => {
    prisma.project.findMany.mockResolvedValue([{ id: "p1", name: "Work", color: "sky", createdAt: new Date() }] as never);
    expect(await ok("list_projects")).toEqual({ projects: [{ id: "p1", name: "Work", color: "sky" }] });
  });

  it("rejects input keys", async () => {
    await fails("list_projects", { name: "x" }, 400);
  });
});

describe("toolResponse", () => {
  it("wraps for /run and unwraps for REST", async () => {
    const good = { ok: true, result: { a: 1 } } as const;
    const bad = { ok: false, status: 404, error: "task not found: x" } as const;
    expect(await toolResponse(good).json()).toEqual({ ok: true, result: { a: 1 } });
    expect(await toolResponse(good, { envelope: false }).json()).toEqual({ a: 1 });
    const res = toolResponse(bad, { envelope: false });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "task not found: x" });
    expect(await toolResponse(bad).json()).toEqual({ ok: false, error: "task not found: x" });
  });
});
