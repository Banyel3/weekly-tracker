import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    task: { findMany: vi.fn() },
    taskEvent: { findMany: vi.fn() },
    appState: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("./db", () => ({ prisma }));

import { loadDigestData } from "./digest";

const d = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

beforeEach(() => vi.clearAllMocks());

describe("loadDigestData", () => {
  it("queries open tasks and this week's carry events, and derives the counts", async () => {
    prisma.task.findMany.mockResolvedValueOnce([
      { id: "a", title: "A", dueDate: d("2026-11-03"), status: "IN_PROGRESS", priority: "HIGH", weekOf: d("2026-11-02"), createdAt: d("2026-11-01"), project: { name: "Home" } },
      { id: "b", title: "B", dueDate: null, status: "BACKLOG", priority: "NONE", weekOf: null, createdAt: d("2026-10-20"), project: null },
      { id: "c", title: "C", dueDate: null, status: "THIS_WEEK", priority: "NONE", weekOf: d("2026-11-02"), createdAt: d("2026-10-30"), project: null },
    ]);
    // "done" was carried and finished this week: not in the open-task query, but on the board.
    prisma.task.findMany.mockResolvedValueOnce([{ id: "b" }, { id: "done" }]);
    prisma.taskEvent.findMany.mockResolvedValue([
      { taskId: "b", type: "ROLLED_BACK", at: d("2026-11-02") },
      { taskId: "done", type: "ROLLED_BACK", at: d("2026-11-02") },
      { taskId: "gone", type: "ROLLED_BACK", at: d("2026-11-02") },
      { taskId: "gone", type: "DELETED", at: d("2026-11-03") },
    ]);

    // Wed 2026-11-04 09:00 Manila.
    const result = await loadDigestData(new Date(Date.UTC(2026, 10, 4, 1, 0)));

    expect(prisma.task.findMany).toHaveBeenCalledTimes(2);
    const taskArgs = prisma.task.findMany.mock.calls[0][0];
    expect(taskArgs.where).toEqual({ archived: false, status: { not: "DONE" } });
    expect(taskArgs.select.project).toEqual({ select: { name: true } });
    expect(prisma.task.findMany.mock.calls[1][0]).toEqual({
      where: {
        id: { in: ["b", "done"] },
        archived: false,
        OR: [{ status: "BACKLOG" }, { weekOf: d("2026-11-02") }],
      },
      select: { id: true },
    });
    expect(prisma.taskEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.taskEvent.findMany.mock.calls[0][0].where).toEqual({
      weekOf: d("2026-11-02"),
      type: { in: ["ROLLED_BACK", "DELETED", "RESTORED"] },
    });

    expect(result.today).toBe("2026-11-04");
    expect(result.week).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(result.inProgress).toBe(1);
    expect(result.openThisWeek).toBe(2);
    expect(result.carried).toBe(2);
    expect(result.tasks[0]).toEqual({
      id: "a",
      title: "A",
      dueDate: "2026-11-03",
      status: "IN_PROGRESS",
      priority: "HIGH",
      createdAt: "2026-11-01T00:00:00.000Z",
      projectName: "Home",
    });
  });

  it("skips the carried lookup when no task was carried", async () => {
    prisma.task.findMany.mockResolvedValueOnce([]);
    prisma.taskEvent.findMany.mockResolvedValue([]);
    const result = await loadDigestData(new Date(Date.UTC(2026, 10, 4, 1, 0)));
    expect(prisma.task.findMany).toHaveBeenCalledTimes(1);
    expect(result.carried).toBe(0);
  });
});
