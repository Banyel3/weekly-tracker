import { describe, expect, it } from "vitest";
import type { TaskDto } from "../../lib/tasks";
import { weekRange } from "../../lib/week";
import { addLabel, addTarget, calendarTasks, chipStyle, dayLabel, isEmptySpot, monthGrid, shiftMonth, weekDays } from "./calendar";

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

describe("addTarget", () => {
  // Wed 11 Nov 2026, 10:00 in Manila: the week runs Mon 9 to Sun 15 Nov.
  const week = weekRange(new Date("2026-11-11T02:00:00Z"));

  it("lands a day later this week in This week", () => {
    expect(addTarget("2026-11-15", week)).toEqual({ mode: "create", initialStatus: "THIS_WEEK", dueDate: "2026-11-15" });
  });

  it("lands today in This week", () => {
    expect(addTarget("2026-11-11", week).initialStatus).toBe("THIS_WEEK");
  });

  it("lands a day last week in This week, as an overdue task", () => {
    expect(addTarget("2026-11-05", week).initialStatus).toBe("THIS_WEEK");
  });

  it("lands a day next week in Future", () => {
    expect(addTarget("2026-11-16", week)).toEqual({ mode: "create", initialStatus: "FUTURE", dueDate: "2026-11-16" });
  });

  it("follows the Manila week at 00:30 on a Monday, still Sunday in UTC", () => {
    // 16:30 UTC on Sun 15 Nov is 00:30 on Mon 16 Nov in Manila, so the new week has started.
    const monday = weekRange(new Date("2026-11-15T16:30:00Z"));
    expect(addTarget("2026-11-16", monday)).toEqual({ mode: "create", initialStatus: "THIS_WEEK", dueDate: "2026-11-16" });
    expect(addTarget("2026-11-22", monday).initialStatus).toBe("THIS_WEEK");
    expect(addTarget("2026-11-23", monday).initialStatus).toBe("FUTURE");
  });
});

describe("isEmptySpot", () => {
  const inside = (selector: string | null) => ({
    closest: (s: string) => (selector && s.split(",").map((x) => x.trim()).includes(selector) ? {} : null),
  });

  it("treats a click on a chip or a button as not empty", () => {
    expect(isEmptySpot(inside("button") as unknown as EventTarget)).toBe(false);
  });

  it("treats a click on the day's free space as empty", () => {
    expect(isEmptySpot(inside(null) as unknown as EventTarget)).toBe(true);
  });
});

describe("addLabel", () => {
  it("names the day the add button adds to", () => {
    expect(addLabel("2026-11-10")).toBe("Add task on Tue 10 Nov");
  });
});
