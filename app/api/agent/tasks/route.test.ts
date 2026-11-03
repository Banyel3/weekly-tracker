import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentRequest, AGENT_TOKEN, taskRow } from "@/lib/agent/restFixtures";

const { prisma, tx } = vi.hoisted(() => {
  const tx = { task: { create: vi.fn() }, taskEvent: { createMany: vi.fn() } };
  const prisma = {
    task: { findMany: vi.fn(async () => []) },
    project: { findFirst: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn() },
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/db", () => ({ prisma }));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AGENT_API_TOKEN", AGENT_TOKEN);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/agent/tasks", () => {
  it("maps query params onto list_tasks and returns the bare result", async () => {
    prisma.task.findMany.mockResolvedValue([taskRow()] as never);
    const res = await GET(agentRequest("/api/agent/tasks?status=this_week,done&archived=true&limit=5&query=brief&due_to=today"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks.map((t: { id: string }) => t.id)).toEqual(["t1"]);
    const args = (prisma.task.findMany.mock.calls[0] as unknown as [any])[0];
    expect(args.take).toBe(5);
    expect(args.where).toMatchObject({ archived: true, status: { in: ["THIS_WEEK", "DONE"] } });
    expect(args.where.OR).toHaveLength(2);
    expect(args.where.dueDate.lte).toBeInstanceOf(Date);
  });

  it("names a bad param in a 400 without the envelope", async () => {
    const res = await GET(agentRequest("/api/agent/tasks?limit=lots"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "limit: Expected number, received string" });
    expect((await GET(agentRequest("/api/agent/tasks?limit=500"))).status).toBe(400);
    expect((await GET(agentRequest("/api/agent/tasks?archived=yes"))).status).toBe(400);
  });

  it("returns 401 without the token", async () => {
    const res = await GET(agentRequest("/api/agent/tasks", { token: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/tasks", () => {
  it("creates a task from the create_task body", async () => {
    tx.task.create.mockImplementation(async ({ data }: any) => taskRow({ id: "new", ...data }));
    const res = await POST(agentRequest("/api/agent/tasks", { method: "POST", body: JSON.stringify({ title: "Call the bank", priority: "high" }) }));
    expect(res.status).toBe(200);
    expect((await res.json()).task).toMatchObject({ id: "new", title: "Call the bank", priority: "HIGH", status: "BACKLOG" });
  });

  it("rejects a missing title, a non-object body and a body over 64 kB", async () => {
    const post = (body: string) => POST(agentRequest("/api/agent/tasks", { method: "POST", body }));
    expect(await (await post("{}")).json()).toEqual({ error: "title: Required" });
    expect(await (await post("[1]")).json()).toEqual({ error: "body must be a JSON object" });
    expect((await post(JSON.stringify({ title: "x", note: "y".repeat(70_000) }))).status).toBe(413);
    expect(tx.task.create).not.toHaveBeenCalled();
  });
});
