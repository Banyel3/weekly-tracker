import { describe, expect, it } from "vitest";
import { createRouteCache } from "./routeCache";

describe("createRouteCache", () => {
  it("misses, hits, updates every entry and invalidates all with no prefix", () => {
    const cache = createRouteCache<number>();
    expect(cache.get("a")).toBeUndefined();
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.update((n) => n * 10);
    expect([cache.get("a"), cache.get("b")]).toEqual([10, 20]);
    cache.invalidate();
    expect([cache.get("a"), cache.get("b")]).toEqual([undefined, undefined]);
  });
});
