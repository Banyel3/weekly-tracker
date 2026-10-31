import { describe, expect, it } from "vitest";
import { decideCatchUp } from "./catchUp";

const NONE = { reminder: null, summary: null };

describe("decideCatchUp", () => {
  it("sends neither before 09:00 Manila", () => {
    expect(decideCatchUp(new Date(Date.UTC(2026, 9, 30, 0, 59)), NONE)).toEqual({ reminder: false, summary: false });
  });

  it("sends the reminder only on Friday 17:59 Manila", () => {
    expect(decideCatchUp(new Date(Date.UTC(2026, 9, 30, 9, 59)), NONE)).toEqual({ reminder: true, summary: false });
  });

  it("sends both on Friday 18:01 Manila", () => {
    expect(decideCatchUp(new Date(Date.UTC(2026, 9, 30, 10, 1)), NONE)).toEqual({ reminder: true, summary: true });
  });

  it("skips jobs already sent today (Manila date)", () => {
    const state = { reminder: "2026-10-30", summary: "2026-10-30" };
    expect(decideCatchUp(new Date(Date.UTC(2026, 9, 30, 12, 0)), state)).toEqual({ reminder: false, summary: false });
  });

  it("resends when the marker is from a previous day", () => {
    const state = { reminder: "2026-10-29", summary: "2026-10-23" };
    expect(decideCatchUp(new Date(Date.UTC(2026, 9, 30, 12, 0)), state)).toEqual({ reminder: true, summary: true });
  });

  it("never sends the summary on a non-Friday", () => {
    expect(decideCatchUp(new Date(Date.UTC(2026, 9, 31, 12, 0)), NONE)).toEqual({ reminder: true, summary: false });
  });

  it("uses the Manila weekday, not UTC (Fri 23:30 UTC is Sat in Manila)", () => {
    expect(decideCatchUp(new Date(Date.UTC(2026, 9, 30, 23, 30)), NONE).summary).toBe(false);
  });
});
