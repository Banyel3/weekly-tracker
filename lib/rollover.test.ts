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
    expect(await rolloverStaleTasks(MONDAY)).toEqual({ archived: 1, returnedToBacklog: 1, promoted: 0 });
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
    expect(await rolloverStaleTasks(MONDAY)).toEqual({ archived: 0, returnedToBacklog: 0, promoted: 0 });
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

describe("rolloverStaleTasks promotes Future tasks", () => {
  const FUTURE = [{ id: "fut", status: "FUTURE" }];
  const callsFor = (id: string) =>
    tx.task.updateMany.mock.calls.map(([arg]) => arg).filter((arg) => arg.where.id.in.includes(id));

  it("locks Future rows due by this Sunday in the same query", async () => {
    tx.$queryRaw.mockResolvedValueOnce([]);
    await rolloverStaleTasks(MONDAY);
    const sql = (tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(sql).toMatch(/status = 'FUTURE'/);
    expect(sql).toMatch(/"dueDate" <= \?::date/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual(["2026-11-02", "2026-11-08"]);
  });

  it("plans a Future task due this Wednesday into This week, once, with one PLANNED", async () => {
    tx.$queryRaw.mockResolvedValueOnce(FUTURE).mockResolvedValue([]);
    expect(await rolloverStaleTasks(MONDAY)).toEqual({ archived: 0, returnedToBacklog: 0, promoted: 1 });
    expect(callsFor("fut")).toEqual([
      {
        where: { id: { in: ["fut"] }, archived: false, status: "FUTURE" },
        data: { status: "THIS_WEEK", weekOf: new Date("2026-11-02T00:00:00.000Z") },
      },
    ]);
    expect(eventTypes()).toEqual(["fut:PLANNED"]);
    const [event] = tx.taskEvent.createMany.mock.calls[0][0].data;
    expect(event).toMatchObject({ from: "FUTURE", to: "THIS_WEEK" });

    vi.clearAllMocks();
    expect(await rolloverStaleTasks(MONDAY)).toEqual({ archived: 0, returnedToBacklog: 0, promoted: 0 });
    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(tx.taskEvent.createMany).not.toHaveBeenCalled();
  });

  it("promotes and records once when two runs overlap", async () => {
    tx.$queryRaw.mockResolvedValueOnce(FUTURE).mockResolvedValue([]);
    await Promise.all([rolloverStaleTasks(MONDAY), rolloverStaleTasks(MONDAY)]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(eventTypes()).toEqual(["fut:PLANNED"]);
  });

  it("never archives, returns to Backlog or bumps rolloverCount on a Future task", async () => {
    tx.$queryRaw.mockResolvedValueOnce([...STALE, ...FUTURE]);
    expect(await rolloverStaleTasks(MONDAY)).toEqual({ archived: 1, returnedToBacklog: 1, promoted: 1 });
    expect(callsFor("fut")).toHaveLength(1);
    expect(callsFor("fut")[0].data).not.toHaveProperty("rolloverCount");
    expect(callsFor("fut")[0].data).not.toHaveProperty("archived");
    expect(eventTypes()).toEqual(["done:ARCHIVED", "open:ROLLED_BACK", "fut:PLANNED"]);
  });

  it("leaves lastRolloverAt alone when it only promoted", async () => {
    tx.$queryRaw.mockResolvedValueOnce(FUTURE);
    await rolloverStaleTasks(MONDAY);
    expect(prisma.appState.upsert).not.toHaveBeenCalled();
  });
});
