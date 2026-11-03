import { afterEach, describe, expect, it, vi } from "vitest";
import { requireAgent } from "./auth";

const req = (authorization?: string) =>
  new Request("http://test/api/agent/tools", { headers: authorization ? { authorization } : {} });

afterEach(() => vi.unstubAllEnvs());

describe("requireAgent", () => {
  it("returns 503 when AGENT_API_TOKEN is unset", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "");
    const res = requireAgent(req("Bearer anything"));
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: "agent api disabled: set AGENT_API_TOKEN" });
  });

  it("returns 401 without a token", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "s3cret");
    const res = requireAgent(req());
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ error: "unauthorized" });
  });

  it.each(["Bearer wrong", "Bearer s3cre", "Bearer s3cret-and-more", "s3cret", "Basic s3cret"])(
    "returns 401 for %j",
    (header) => {
      vi.stubEnv("AGENT_API_TOKEN", "s3cret");
      expect(requireAgent(req(header))?.status).toBe(401);
    },
  );

  it("passes the right token, any scheme case", () => {
    vi.stubEnv("AGENT_API_TOKEN", "s3cret");
    expect(requireAgent(req("Bearer s3cret"))).toBeNull();
    expect(requireAgent(req("bearer s3cret"))).toBeNull();
  });
});
