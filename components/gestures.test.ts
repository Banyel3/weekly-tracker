import { describe, expect, it } from "vitest";
import { isLongPressWithoutMove, shouldDismiss } from "./gestures";

describe("shouldDismiss", () => {
  it("dismisses past the distance threshold", () => {
    expect(shouldDismiss(121, 0)).toBe(true);
    expect(shouldDismiss(120, 0)).toBe(false);
  });

  it("dismisses a short downward flick", () => {
    expect(shouldDismiss(20, 0.6)).toBe(true);
    expect(shouldDismiss(20, 0.5)).toBe(false);
  });

  it("never dismisses an upward drag, however fast", () => {
    expect(shouldDismiss(0, 2)).toBe(false);
    expect(shouldDismiss(-40, 2)).toBe(false);
  });
});

describe("isLongPressWithoutMove", () => {
  const still = { touch: true, delta: { x: 3, y: 4 }, over: "THIS_WEEK" as const, from: "THIS_WEEK" as const };

  it("is a Move-sheet request when a touch press ends in place over its own column", () => {
    expect(isLongPressWithoutMove(still)).toBe(true);
  });

  it("counts a release over nothing", () => {
    expect(isLongPressWithoutMove({ ...still, over: undefined })).toBe(true);
  });

  it("is a real move once the finger travelled 8px", () => {
    expect(isLongPressWithoutMove({ ...still, delta: { x: 8, y: 0 } })).toBe(false);
  });

  it("is a real move when released over another column", () => {
    expect(isLongPressWithoutMove({ ...still, over: "DONE" })).toBe(false);
  });

  it("ignores mouse and keyboard drags", () => {
    expect(isLongPressWithoutMove({ ...still, touch: false })).toBe(false);
  });
});
