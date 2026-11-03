import type { Task } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentRequest, AGENT_TOKEN, taskRow } from "@/lib/agent/restFixtures";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    task: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    taskEvent: { createMany: vi.fn() },
  };
  const prisma = {
    task: { findUnique: vi.fn() },
    taskEvent: { findMany: vi.fn(async () => []) },
    project: { findFirst: vi.fn() },
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/db", () => ({ prisma }));

import { DELETE, GET, PATCH } from "./route";

const ctx = (id = "t1") => ({ params: Promise.resolve({ id }) });

function withTask(task: Task | null) {
  prisma.task.findUnique.mockResolvedValue(task);
  tx.task.findUnique.mockResolvedValue(task);
  tx.task.update.mockImplementation(async ({ data }: any) => ({ ...task, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }));
  tx.task.delete.mockResolvedValue(task);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AGENT_API_TOKEN", AGENT_TOKEN);
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/agent/tasks/{id}", () => {
  it("GET returns the task with events, 404 when unknown", async () => {
    withTask(taskRow());
    const res = await GET(agentRequest("/api/agent/tasks/t1"), ctx());
    expect(await res.json()).toEqual({ task: expect.objectContaining({ id: "t1" }), events: [] });
    withTask(null);
    const missing = await GET(agentRequest("/api/agent/tasks/nope"), ctx("nope"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "task not found: nope" });
  });

  it("PATCH applies the update_task body with the path id", async () => {
    withTask(taskRow({ dueDate: new Date("2026-11-06T00:00:00.000Z") }));
    const res = await PATCH(
      agentRequest("/api/agent/tasks/t1", { method: "PATCH", body: JSON.stringify({ id: "other", title: "Renamed", due: null }) }),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).task).toMatchObject({ id: "t1", title: "Renamed", dueDate: null });
    expect(tx.task.update.mock.calls[0][0].where).toEqual({ id: "t1" });
  });

  it("PATCH with an empty body is a 400", async () => {
    const res = await PATCH(agentRequest("/api/agent/tasks/t1", { method: "PATCH" }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^nothing to update/);
  });

  it("DELETE deletes, 404 when unknown", async () => {
    withTask(taskRow());
    const res = await DELETE(agentRequest("/api/agent/tasks/t1", { method: "DELETE" }), ctx());
    expect(await res.json()).toEqual({ deleted: true });
    withTask(null);
    expect((await DELETE(agentRequest("/api/agent/tasks/nope", { method: "DELETE" }), ctx("nope"))).status).toBe(404);
  });
});
