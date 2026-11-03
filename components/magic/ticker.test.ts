import { describe, expect, it } from "vitest";
import { shouldTick } from "./ticker";

describe("shouldTick", () => {
  it("does not animate the first render", () => {
    expect(shouldTick(null, 4)).toBe(false);
  });

  it("does not animate when the value is unchanged", () => {
    expect(shouldTick(4, 4)).toBe(false);
  });

  it("animates a change after the first render", () => {
    expect(shouldTick(4, 5)).toBe(true);
    expect(shouldTick(4, 0)).toBe(true);
  });
});
