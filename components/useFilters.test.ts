import { describe, expect, it } from "vitest";
import type { TaskDto } from "@/lib/tasks";
import { matchesFilter } from "./useFilters";

const task = { title: "Write Report", note: "for the Q4 board", projectId: "p1", dueDate: "2026-11-03" } as TaskDto;

describe("matchesFilter", () => {
  it("passes everything without a filter", () => {
    expect(matchesFilter(task, null)).toBe(true);
  });

  it("matches by project and by due day", () => {
    expect(matchesFilter(task, { kind: "project", id: "p1" })).toBe(true);
    expect(matchesFilter(task, { kind: "project", id: "p2" })).toBe(false);
    expect(matchesFilter(task, { kind: "day", ymd: "2026-11-03" })).toBe(true);
    expect(matchesFilter(task, { kind: "day", ymd: "2026-11-04" })).toBe(false);
  });

  it("searches title and note case-insensitively", () => {
    expect(matchesFilter(task, { kind: "query", q: "report" })).toBe(true);
    expect(matchesFilter(task, { kind: "query", q: "q4" })).toBe(true);
    expect(matchesFilter(task, { kind: "query", q: "missing" })).toBe(false);
    expect(matchesFilter({ ...task, note: null }, { kind: "query", q: "q4" })).toBe(false);
  });
});
