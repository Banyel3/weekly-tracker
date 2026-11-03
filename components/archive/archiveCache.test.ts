import { describe, expect, it } from "vitest";
import type { ArchiveDto, ArchiveWeek } from "@/lib/archive";
import type { TaskDto } from "@/lib/tasks";
import { appendPage, dropTask, mergeFirstPage } from "./archiveCache";

const week = (start: string, ...ids: string[]): ArchiveWeek => ({
  start,
  end: start,
  tasks: ids.map((id) => ({ id }) as TaskDto),
});
const starts = (page: ArchiveDto) => page.weeks.map((w) => w.start);

describe("archive cache helpers", () => {
  const loaded: ArchiveDto = {
    weeks: [week("2026-10-26", "a"), week("2026-10-19", "b"), week("2026-10-12", "c")],
    nextBefore: "2026-10-12",
  };

  it("keeps pages loaded with older past a fresh first page", () => {
    const first: ArchiveDto = { weeks: [week("2026-10-26", "a", "n")], nextBefore: "2026-10-26" };
    const merged = mergeFirstPage(first, loaded);
    expect(starts(merged)).toEqual(["2026-10-26", "2026-10-19", "2026-10-12"]);
    expect(merged.weeks[0].tasks.map((t) => t.id)).toEqual(["a", "n"]);
    expect(merged.nextBefore).toBe("2026-10-12");
  });

  it("takes the fresh first page alone when nothing is cached or it is the last page", () => {
    const first: ArchiveDto = { weeks: [week("2026-10-26", "a")], nextBefore: null };
    expect(mergeFirstPage(first, undefined)).toBe(first);
    expect(mergeFirstPage(first, loaded)).toBe(first);
  });

  it("appends an older page without repeating a week", () => {
    const next: ArchiveDto = { weeks: [week("2026-10-12", "c"), week("2026-10-05", "d")], nextBefore: null };
    const appended = appendPage(loaded, next);
    expect(starts(appended)).toEqual(["2026-10-26", "2026-10-19", "2026-10-12", "2026-10-05"]);
    expect(appended.nextBefore).toBeNull();
  });

  it("drops a restored or deleted task from every week", () => {
    expect(dropTask(loaded, "b").weeks.map((w) => w.tasks.length)).toEqual([1, 0, 1]);
  });
});
