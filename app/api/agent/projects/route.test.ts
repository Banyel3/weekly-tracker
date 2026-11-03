import { afterEach, describe, expect, it, vi } from "vitest";
import { agentRequest } from "@/lib/agent/restFixtures";

const { prisma } = vi.hoisted(() => ({
  prisma: { project: { findMany: vi.fn(async () => [{ id: "p1", name: "Work", color: "sky" }]) } },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/agent/projects", () => {
  it("returns list_projects without the envelope", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "rest-token");
    expect(await (await GET(agentRequest("/api/agent/projects"))).json()).toEqual({ projects: [{ id: "p1", name: "Work", color: "sky" }] });
  });

  it("returns 503 when the API is disabled", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "");
    expect((await GET(agentRequest("/api/agent/projects"))).status).toBe(503);
  });
});
