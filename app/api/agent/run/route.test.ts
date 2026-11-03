import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { project: { findMany: vi.fn(async () => [{ id: "p1", name: "Work", color: "sky" }]) } },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import { POST } from "./route";

const TOKEN = "test-token";

const post = (body: unknown, token: string | null = TOKEN) =>
  POST(
    new Request("http://test/api/agent/run", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => vi.stubEnv("AGENT_API_TOKEN", TOKEN));
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/agent/run", () => {
  it("runs a tool and wraps the result", async () => {
    const res = await post({ name: "list_projects", input: {} });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: { projects: [{ id: "p1", name: "Work", color: "sky" }] } });
  });

  it("defaults a missing input to {}", async () => {
    expect((await post({ name: "list_projects" })).status).toBe(200);
  });

  it("returns 404 for an unknown tool", async () => {
    const res = await post({ name: "make_coffee", input: {} });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "unknown tool: make_coffee" });
  });

  it("returns 400 for invalid tool input", async () => {
    const res = await post({ name: "list_tasks", input: { limit: 500 } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: expect.stringMatching(/^limit: /) });
  });

  it("returns 400 for a malformed envelope or JSON", async () => {
    expect(await (await post({ input: {} })).json()).toEqual({ ok: false, error: "name: Required" });
    expect((await post({ name: "get_today", input: [] })).status).toBe(400);
    expect(await (await post("{nope")).json()).toEqual({ ok: false, error: "Invalid JSON" });
  });

  it("returns 413 over 64 kB", async () => {
    const res = await post({ name: "create_task", input: { title: "x", note: "y".repeat(65 * 1024) } });
    expect(res.status).toBe(413);
    expect((await res.json()).ok).toBe(false);
  });

  it("checks the token before reading the body", async () => {
    const res = await post("{nope", "wrong");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "unauthorized" });
  });

  it("returns 503 when the API is disabled", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "");
    const res = await post({ name: "list_projects" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "agent api disabled: set AGENT_API_TOKEN" });
  });
});
