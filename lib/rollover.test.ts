import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    task: { updateMany: vi.fn() },
    taskEvent: { createMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
    appState: { upsert: vi.fn() },
  };
  return { prisma, tx };
});

vi.mock("./db", () => ({ prisma }));

import { rolloverStaleTasks } from "./rollover";

const MONDAY = new Date("2026-11-01T16:00:00.000Z");
const STALE = [
  { id: "done", status: "DONE" },
  { id: "open", status: "IN_PROGRESS" },
];

function eventTypes() {
  return tx.taskEvent.createMany.mock.calls.flatMap(([arg]) =>
    arg.data.map((e: { taskId: string; type: string }) => `${e.taskId}:${e.type}`),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  tx.task.updateMany.mockImplementation(async ({ where }) => ({ count: where.id.in.length }));
});

describe("rolloverStaleTasks", () => {
  it("records events only for the rows it locked, by status", async () => {
    tx.$queryRaw.mockResolvedValueOnce(STALE);
    expect(await rolloverStaleTasks(MONDAY)).toEqual({ archived: 1, returnedToBacklog: 1 });
    expect(eventTypes()).toEqual(["done:ARCHIVED", "open:ROLLED_BACK"]);
    expect(prisma.appState.upsert).toHaveBeenCalledTimes(1);
  });

  it("shares one run between concurrent callers (weekly and hourly crons at Monday 00:00)", async () => {
    tx.$queryRaw.mockResolvedValueOnce(STALE).mockResolvedValue([]);
    const [a, b] = await Promise.all([rolloverStaleTasks(MONDAY), rolloverStaleTasks(MONDAY)]);
    expect(a).toBe(b);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(eventTypes()).toEqual(["done:ARCHIVED", "open:ROLLED_BACK"]);
  });

  it("writes no events and leaves lastRolloverAt alone when a later run finds nothing", async () => {
    tx.$queryRaw.mockResolvedValueOnce(STALE).mockResolvedValue([]);
    await rolloverStaleTasks(MONDAY);
    vi.clearAllMocks();
    expect(await rolloverStaleTasks(MONDAY)).toEqual({ archived: 0, returnedToBacklog: 0 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(tx.taskEvent.createMany).not.toHaveBeenCalled();
    expect(prisma.appState.upsert).not.toHaveBeenCalled();
  });

  it("locks the stale rows inside the transaction before updating them", async () => {
    tx.$queryRaw.mockResolvedValueOnce([]);
    await rolloverStaleTasks(MONDAY);
    const sql = (tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/archived = false/);
    expect(tx.$queryRaw.mock.calls[0][1]).toBe("2026-11-02");
  });
});
