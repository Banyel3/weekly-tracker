import type { Task } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    task: { findUnique: vi.fn(), update: vi.fn() },
    taskEvent: { createMany: vi.fn() },
  };
  const prisma = { $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)) };
  return { prisma, tx };
});

vi.mock("@/lib/db", () => ({ prisma }));

import { PATCH } from "./route";

const archivedDone = {
  id: "t1",
  title: "Old task",
  note: null,
  dueDate: null,
  status: "DONE",
  weekOf: new Date("2026-10-19T00:00:00.000Z"),
  rolledBackAt: null,
  projectId: null,
  priority: "NONE",
  checklist: [],
  rolloverCount: 0,
  completedAt: new Date("2026-10-21T00:00:00.000Z"),
  archived: true,
  createdAt: new Date("2026-10-19T01:00:00.000Z"),
  updatedAt: new Date("2026-10-26T00:00:00.000Z"),
} as Task;

const patch = (body: unknown) =>
  PATCH(new Request("http://test/api/tasks/t1", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "t1" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  tx.task.findUnique.mockResolvedValue(archivedDone);
  tx.task.update.mockImplementation(async ({ data }) => ({ ...archivedDone, ...data }));
});

describe("PATCH /api/tasks/[id] on an archived task", () => {
  it("rejects a status change without a restore", async () => {
    const res = await patch({ status: "THIS_WEEK" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "restore the task before changing its status" });
    expect(tx.task.update).not.toHaveBeenCalled();
    expect(tx.taskEvent.createMany).not.toHaveBeenCalled();
  });

  it("accepts a status in the same request as the restore", async () => {
    const res = await patch({ archived: false, status: "THIS_WEEK" });
    expect(res.status).toBe(200);
    expect((await res.json()).archived).toBe(false);
  });

  it("still accepts edits that do not change the status", async () => {
    expect((await patch({ title: "Renamed" })).status).toBe(200);
  });
});
