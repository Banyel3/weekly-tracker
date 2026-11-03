import { beforeEach, describe, expect, it } from "vitest";
import { cachedState, fetchJson, invalidateJson } from "./jsonCache";

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
const failing = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
const offline = (async () => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch;

describe("jsonCache", () => {
  beforeEach(() => invalidateJson(""));

  it("misses before the first fetch and for a null url", () => {
    expect(cachedState("/api/review")).toEqual({ status: "loading" });
    expect(cachedState(null)).toEqual({ status: "loading" });
  });

  it("hits after a fetch, so a remount renders ready at once", async () => {
    await fetchJson("/api/review", ok({ n: 1 }));
    expect(cachedState("/api/review")).toEqual({ status: "ready", data: { n: 1 } });
  });

  it("replaces the entry when a background revalidation succeeds", async () => {
    await fetchJson("/api/review", ok({ n: 1 }));
    await expect(fetchJson("/api/review", ok({ n: 2 }))).resolves.toEqual({ n: 2 });
    expect(cachedState("/api/review")).toEqual({ status: "ready", data: { n: 2 } });
  });

  it("keeps the cached data when a background revalidation fails", async () => {
    await fetchJson("/api/review", ok({ n: 1 }));
    await expect(fetchJson("/api/review", failing)).rejects.toThrow();
    await expect(fetchJson("/api/review", offline)).rejects.toThrow();
    expect(cachedState("/api/review")).toEqual({ status: "ready", data: { n: 1 } });
  });

  it("keys entries by full url and invalidates by prefix", async () => {
    await fetchJson("/api/review", ok({ n: 1 }));
    await fetchJson("/api/archive?q=a", ok({ n: 2 }));
    await fetchJson("/api/archive?q=b", ok({ n: 3 }));
    invalidateJson("/api/archive");
    expect(cachedState("/api/archive?q=a")).toEqual({ status: "loading" });
    expect(cachedState("/api/archive?q=b")).toEqual({ status: "loading" });
    expect(cachedState("/api/review")).toEqual({ status: "ready", data: { n: 1 } });
  });
});
