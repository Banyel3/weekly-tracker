import type { Task } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    task: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    taskEvent: { createMany: vi.fn() },
  };
  const prisma = {
    task: { findUnique: vi.fn(), findMany: vi.fn(async (_args: { where?: any }): Promise<Task[]> => []), count: vi.fn(async () => 0) },
    project: { findMany: vi.fn(async () => []) },
    taskEvent: { findMany: vi.fn() },
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { prisma, tx };
});

vi.mock("./db", () => ({ prisma }));

import { createTask, listBoard, updateTask, type CreateTaskInput } from "./tasks";

const row = (over: Partial<Task> = {}) =>
  ({
    id: "t1",
    title: "Write the brief",
    note: null,
    dueDate: null,
    status: "THIS_WEEK",
    weekOf: new Date("2026-11-02T00:00:00.000Z"),
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

beforeEach(() => vi.clearAllMocks());

describe("updateTask", () => {
  it("reads the row it replaces inside the transaction", async () => {
    tx.task.findUnique.mockResolvedValue(row());
    tx.task.update.mockImplementation(async ({ data }) => row({ status: data.status, completedAt: data.completedAt }));
    const dto = await updateTask("t1", { status: "DONE" });
    expect(prisma.task.findUnique).not.toHaveBeenCalled();
    expect(tx.task.findUnique).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(dto?.status).toBe("DONE");
    expect(dto?.completedAt).not.toBeNull();
    const types = tx.taskEvent.createMany.mock.calls[0][0].data.map((e: { type: string }) => e.type);
    expect(types).toEqual(["DONE"]);
  });

  it("returns null without writing when the task is gone", async () => {
    tx.task.findUnique.mockResolvedValue(null);
    expect(await updateTask("missing", { title: "x" })).toBeNull();
    expect(tx.task.update).not.toHaveBeenCalled();
    expect(tx.taskEvent.createMany).not.toHaveBeenCalled();
  });
});

describe("listBoard carriedIds", () => {
  it("lists this Monday's rolled-back tasks from events, minus deleted ones", async () => {
    const at = new Date("2026-11-01T16:00:00.000Z");
    prisma.taskEvent.findMany.mockResolvedValue([
      { taskId: "replanned", type: "ROLLED_BACK", at },
      { taskId: "gone", type: "ROLLED_BACK", at },
      { taskId: "gone", type: "DELETED", at: new Date("2026-11-03T02:00:00.000Z") },
    ]);
    const board = await listBoard(new Date("2026-11-03T04:00:00.000Z"));
    expect(board.carriedIds).toEqual(["replanned"]);
    expect(prisma.taskEvent.findMany.mock.calls[0][0].where.weekOf).toEqual(new Date("2026-11-02T00:00:00.000Z"));
  });
});

describe("listBoard future", () => {
  it("returns Future tasks in their own list, never in the columns", async () => {
    prisma.taskEvent.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValueOnce([
      row({ id: "backlog", status: "BACKLOG", weekOf: null }),
      row({ id: "undated", status: "FUTURE", weekOf: null }),
      row({ id: "next-week", status: "FUTURE", weekOf: null, dueDate: new Date("2026-11-10T00:00:00.000Z") }),
      row({ id: "planned" }),
    ]);
    const board = await listBoard(new Date("2026-11-04T04:00:00.000Z"));
    expect(board.tasks.map((t) => t.id)).toEqual(["backlog", "planned"]);
    expect(board.future.map((t) => t.id)).toEqual(["next-week", "undated"]);
    const where = prisma.task.findMany.mock.calls[0][0].where;
    expect(where.archived).toBe(false);
    expect(where.OR).toContainEqual({ status: { in: ["BACKLOG", "FUTURE"] } });
  });

  it("leaves Future tasks out of the live count, so the Board and Future badges never count a task twice", async () => {
    prisma.taskEvent.findMany.mockResolvedValue([]);
    await listBoard(new Date("2026-11-04T04:00:00.000Z"));
    expect(prisma.task.count.mock.calls[0]).toEqual([{ where: { archived: false, status: { not: "FUTURE" } } }]);
  });
});

describe("Future tasks on save", () => {
  // Wed 2026-11-04 12:00 Manila: this week runs Mon 2026-11-02 to Sun 2026-11-08.
  const MONDAY = new Date("2026-11-02T00:00:00.000Z");
  const input = (over: Partial<CreateTaskInput>): CreateTaskInput => ({
    title: "Plan the offsite",
    status: "FUTURE",
    priority: "NONE",
    checklist: [],
    ...over,
  });
  const saved = () => (tx.task.create.mock.calls[0] ?? tx.task.update.mock.calls[0])[0].data;
  const events = () => tx.taskEvent.createMany.mock.calls.flatMap(([arg]) => arg.data.map((e: { type: string }) => e.type));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T04:00:00.000Z"));
    tx.task.create.mockImplementation(async ({ data }) => row({ ...data }));
    tx.task.update.mockImplementation(async ({ data }) => row({ ...data }));
  });
  afterEach(() => vi.useRealTimers());

  it("keeps an undated Future task in Future with no week", async () => {
    await createTask(input({ dueDate: null }));
    expect(saved()).toMatchObject({ status: "FUTURE", weekOf: null });
    expect(events()).toEqual(["CREATED"]);
  });

  it("keeps a Future task due next week in Future", async () => {
    await createTask(input({ dueDate: "2026-11-09" }));
    expect(saved()).toMatchObject({ status: "FUTURE", weekOf: null });
    expect(events()).toEqual(["CREATED"]);
  });

  it("plans a Future task due this Thursday into This week with one PLANNED", async () => {
    const dto = await createTask(input({ dueDate: "2026-11-05" }));
    expect(saved()).toMatchObject({ status: "THIS_WEEK", weekOf: MONDAY });
    expect(dto.status).toBe("THIS_WEEK");
    expect(events()).toEqual(["CREATED", "PLANNED"]);
  });

  it("plans a Future task due this Sunday", async () => {
    await createTask(input({ dueDate: "2026-11-08" }));
    expect(saved()).toMatchObject({ status: "THIS_WEEK", weekOf: MONDAY });
  });

  it("plans a Future task due last week, so it shows as overdue on the board", async () => {
    await createTask(input({ dueDate: "2026-10-28" }));
    expect(saved()).toMatchObject({ status: "THIS_WEEK", weekOf: MONDAY });
  });

  it("plans a Future task when its due date moves into this week", async () => {
    tx.task.findUnique.mockResolvedValue(row({ status: "FUTURE", weekOf: null, dueDate: new Date("2026-12-10T00:00:00.000Z") }));
    const dto = await updateTask("t1", { dueDate: "2026-11-05" });
    expect(saved()).toMatchObject({ status: "THIS_WEEK", weekOf: MONDAY });
    expect(dto?.status).toBe("THIS_WEEK");
    expect(events()).toEqual(["PLANNED", "RESCHEDULED"]);
  });

  it("plans a task moved to Future when it is due this week", async () => {
    tx.task.findUnique.mockResolvedValue(row({ status: "BACKLOG", weekOf: null, dueDate: new Date("2026-11-06T00:00:00.000Z") }));
    await updateTask("t1", { status: "FUTURE" });
    expect(saved()).toMatchObject({ status: "THIS_WEEK", weekOf: MONDAY });
    expect(events()).toEqual(["PLANNED"]);
  });

  it("leaves a Future task alone when an edit touches neither status nor due date", async () => {
    tx.task.findUnique.mockResolvedValue(row({ status: "FUTURE", weekOf: null, dueDate: new Date("2026-11-05T00:00:00.000Z") }));
    await updateTask("t1", { title: "Renamed" });
    expect(saved()).not.toHaveProperty("status");
    expect(tx.taskEvent.createMany).not.toHaveBeenCalled();
  });

  it("keeps a Future task in Future when its due date moves to next month", async () => {
    tx.task.findUnique.mockResolvedValue(row({ status: "FUTURE", weekOf: null, dueDate: null }));
    await updateTask("t1", { dueDate: "2026-12-01" });
    expect(saved()).not.toHaveProperty("status");
    expect(events()).toEqual(["RESCHEDULED"]);
  });
});
