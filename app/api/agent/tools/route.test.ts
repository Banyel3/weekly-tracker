import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_TOOLS } from "@/lib/agent/ops";
import { GET } from "./route";

const get = (authorization?: string) =>
  GET(new Request("http://test/api/agent/tools", { headers: authorization ? { authorization } : {} }));

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/agent/tools", () => {
  it("returns the tool definitions with the right token", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "t0k");
    const res = await get("Bearer t0k");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tools).toEqual(AGENT_TOOLS);
    expect(body.tools).toHaveLength(12);
  });

  it("returns 401 with a wrong or missing token", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "t0k");
    expect((await get("Bearer nope")).status).toBe(401);
    expect((await get()).status).toBe(401);
  });

  it("returns 503 without AGENT_API_TOKEN", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "");
    expect((await get("Bearer t0k")).status).toBe(503);
  });
});
