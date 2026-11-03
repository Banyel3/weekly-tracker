import type { Task } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentRequest, AGENT_TOKEN, taskRow } from "@/lib/agent/restFixtures";

const { prisma, tx } = vi.hoisted(() => {
  const tx = { task: { findUnique: vi.fn(), update: vi.fn() }, taskEvent: { createMany: vi.fn() } };
  const prisma = {
    task: { findUnique: vi.fn() },
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/db", () => ({ prisma }));

import { POST } from "./route";

function withTask(task: Task) {
  let current = task;
  prisma.task.findUnique.mockImplementation(async () => current);
  tx.task.findUnique.mockImplementation(async () => current);
  tx.task.update.mockImplementation(async ({ data }: any) => {
    current = { ...current, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) } as Task;
    return current;
  });
}

const act = (action: string, body?: unknown, token?: string | null) =>
  POST(
    agentRequest(`/api/agent/tasks/t1/${action}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body), token }),
    { params: Promise.resolve({ id: "t1", action }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AGENT_API_TOKEN", AGENT_TOKEN);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/agent/tasks/{id}/{action}", () => {
  it.each([
    ["done", "DONE"],
    ["start", "IN_PROGRESS"],
    ["plan", "THIS_WEEK"],
    ["backlog", "BACKLOG"],
  ])("%s moves the task to %s", async (action, status) => {
    withTask(taskRow({ status: action === "plan" ? "BACKLOG" : "THIS_WEEK" }));
    const res = await act(action);
    expect(res.status).toBe(200);
    expect((await res.json()).task.status).toBe(status);
  });

  it("snooze takes an optional body", async () => {
    withTask(taskRow());
    expect((await (await act("snooze")).json()).task.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    withTask(taskRow());
    expect((await (await act("snooze", { until: "2099-01-31" })).json()).task.dueDate).toBe("2099-01-31");
    expect((await act("snooze", { days: 0 })).status).toBe(400);
  });

  it("restore takes an optional status", async () => {
    withTask(taskRow({ archived: true, status: "DONE" }));
    const res = await act("restore", { status: "plan" });
    expect(res.status).toBe(400);
    withTask(taskRow({ archived: true, status: "DONE" }));
    expect((await (await act("restore", { status: "this_week" })).json()).task).toMatchObject({ archived: false, status: "THIS_WEEK" });
  });

  it("returns 404 for an unknown action, after auth", async () => {
    const res = await act("finish");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "unknown action: finish" });
    expect((await act("finish", undefined, "wrong")).status).toBe(401);
  });
});
