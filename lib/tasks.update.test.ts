import type { Task } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    task: { findUnique: vi.fn(), update: vi.fn() },
    taskEvent: { createMany: vi.fn() },
  };
  const prisma = {
    task: { findUnique: vi.fn(), findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    project: { findMany: vi.fn(async () => []) },
    taskEvent: { findMany: vi.fn() },
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { prisma, tx };
});

vi.mock("./db", () => ({ prisma }));

import { listBoard, updateTask } from "./tasks";

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
