import { describe, expect, it } from "vitest";
import type { LoadStatus } from "./useBoard";
import { reviewUrl } from "./reviewUrl";

describe("reviewUrl", () => {
  it("asks for nothing until the board has loaded", () => {
    expect(reviewUrl("loading")).toBeNull();
    expect(reviewUrl("error")).toBeNull();
    expect(reviewUrl("ready")).toBe("/api/review");
  });

  it("fetches once across mount: loading at version 0, then ready at version 1", () => {
    const renders: [LoadStatus, number][] = [
      ["loading", 0],
      ["ready", 1],
    ];
    let previous: string | null = null;
    let fetches = 0;
    for (const [status, version] of renders) {
      const key = reviewUrl(status) === null ? null : `${reviewUrl(status)}#${version}`;
      if (key !== null && key !== previous) fetches += 1;
      previous = key;
    }
    expect(fetches).toBe(1);
  });
});
