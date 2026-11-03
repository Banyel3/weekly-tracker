import { describe, expect, it } from "vitest";
import type { TaskDto } from "../../lib/tasks";
import { calendarTasks, chipStyle, dayLabel, monthGrid, shiftMonth, weekDays } from "./calendar";

const task = (over: Partial<TaskDto>) =>
  ({
    id: "t",
    title: "Pay rent",
    status: "THIS_WEEK",
    archived: false,
    dueDate: "2026-11-03",
    projectId: null,
    ...over,
  }) as TaskDto;

describe("chipStyle", () => {
  it("tints with the project color and edges it", () => {
    expect(chipStyle({ color: "teal", done: false, overdue: false })).toEqual({
      background: "color-mix(in oklch, var(--project-teal) 22%, transparent)",
      boxShadow: "inset 3px 0 0 var(--project-teal)",
    });
  });

  it("falls back to slate without a project", () => {
    expect(chipStyle({ color: null, done: false, overdue: false }).background).toBe(
      "color-mix(in oklch, var(--project-slate) 22%, transparent)",
    );
  });

  it("edges overdue chips in the alert color, never done ones", () => {
    expect(chipStyle({ color: "rose", done: false, overdue: true }).boxShadow).toBe("inset 3px 0 0 var(--alert)");
    expect(chipStyle({ color: "rose", done: true, overdue: true }).boxShadow).toBe("inset 3px 0 0 var(--project-rose)");
  });
});

describe("weekDays and monthGrid", () => {
  it("lists Monday to Sunday", () => {
    expect(weekDays("2026-10-26")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("covers a month in six Monday-first weeks", () => {
    const grid = monthGrid({ year: 2026, month: 11 });
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(grid[41]).toBe("2026-12-06");
  });

  it("steps across year ends", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("names a day the short way", () => {
    expect(dayLabel("2026-10-29")).toBe("Thu 29");
  });
});

describe("calendarTasks", () => {
  const tasks = [
    task({ id: "a", projectId: "p1" }),
    task({ id: "b", projectId: "p2", title: "Other" }),
    task({ id: "c", dueDate: null }),
    task({ id: "d", archived: true }),
    task({ id: "e", dueDate: "2026-11-09" }),
  ];
  const ids = (ts: TaskDto[]) => ts.map((t) => t.id);

  it("keeps live dated tasks inside the range", () => {
    expect(ids(calendarTasks(tasks, null, "2026-11-02", "2026-11-08"))).toEqual(["a", "b"]);
  });

  it("follows the project filter but ignores search and day filters", () => {
    expect(ids(calendarTasks(tasks, { kind: "project", id: "p1" }, "2026-11-02", "2026-11-08"))).toEqual(["a"]);
    expect(ids(calendarTasks(tasks, { kind: "query", q: "zzz" }, "2026-11-02", "2026-11-08"))).toEqual(["a", "b"]);
    expect(ids(calendarTasks(tasks, { kind: "day", ymd: "2026-11-04" }, "2026-11-02", "2026-11-08"))).toEqual([
      "a",
      "b",
    ]);
  });
});
