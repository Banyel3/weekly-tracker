import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUndoSlot, deletedLabel, movedLabel, rescheduledLabel, type UndoLineState } from "./useUndo";

describe("undo labels", () => {
  it("builds the exact copy", () => {
    expect(movedLabel("Pay rent", "Done")).toBe("moved “Pay rent” to Done");
    expect(deletedLabel("Pay rent")).toBe("deleted “Pay rent”");
    expect(rescheduledLabel("Pay rent", "2026-11-12")).toBe("rescheduled “Pay rent” to Nov 12");
  });
});

describe("createUndoSlot", () => {
  let line: UndoLineState | null;
  const slot = () => createUndoSlot((next) => (line = next), 5000);

  beforeEach(() => {
    vi.useFakeTimers();
    line = null;
  });
  afterEach(() => vi.useRealTimers());

  it("shows the label, then commits and clears after 5s", () => {
    const s = slot();
    const commit = vi.fn();
    s.register({ label: "deleted “a”", undo: vi.fn(), commit });
    expect(line?.label).toBe("deleted “a”");
    vi.advanceTimersByTime(4999);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledOnce();
    expect(line).toBeNull();
  });

  it("undo runs the undo, skips the commit and clears the line", async () => {
    const s = slot();
    const undo = vi.fn();
    const commit = vi.fn();
    s.register({ label: "x", undo, commit });
    await s.undo();
    vi.advanceTimersByTime(10_000);
    expect(undo).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    expect(line).toBeNull();
  });

  it("a new action commits the previous one at once and restarts the window", () => {
    const s = slot();
    const first = vi.fn();
    const second = vi.fn();
    s.register({ label: "one", undo: vi.fn(), commit: first });
    vi.advanceTimersByTime(3000);
    s.register({ label: "two", undo: vi.fn(), commit: second });
    expect(first).toHaveBeenCalledOnce();
    expect(line?.label).toBe("two");
    vi.advanceTimersByTime(4999);
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(second).toHaveBeenCalledOnce();
  });

  it("flush commits the pending action immediately and only once", () => {
    const s = slot();
    const commit = vi.fn();
    s.register({ label: "x", undo: vi.fn(), commit });
    s.flush();
    vi.advanceTimersByTime(10_000);
    expect(commit).toHaveBeenCalledOnce();
    expect(line).toBeNull();
  });

  it("undo after expiry does nothing", async () => {
    const s = slot();
    const undo = vi.fn();
    s.register({ label: "x", undo });
    vi.advanceTimersByTime(5000);
    await s.undo();
    expect(undo).not.toHaveBeenCalled();
  });

  it("gives each registration a new id so the same label re-announces", () => {
    const s = slot();
    s.register({ label: "x", undo: vi.fn() });
    const first = line?.id;
    s.register({ label: "x", undo: vi.fn() });
    expect(line?.id).not.toBe(first);
  });
});
