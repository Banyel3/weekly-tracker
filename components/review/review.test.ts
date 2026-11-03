import { describe, expect, it } from "vitest";
import type { ReviewDto } from "../../lib/review";
import type { TaskDto } from "../../lib/tasks";
import {
  carriedRows,
  completionLine,
  daysText,
  droppedLine,
  originLine,
  shareText,
  trendTick,
  decidedReducer,
  decidedText,
  dayLine,
  headline,
  lastWeekHeading,
  lastWeekLine,
  nudgeCount,
  type DecidedMap,
} from "./review";

const MONDAY = "2026-11-02";

function task(id: string, over: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    title: `Task ${id}`,
    note: null,
    dueDate: null,
    status: "BACKLOG",
    weekOf: null,
    rolledBackAt: MONDAY,
    projectId: null,
    priority: "NONE",
    checklist: [],
    rolloverCount: 1,
    completedAt: null,
    archived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

const entry = (id: string, over: Partial<TaskDto> = {}) => {
  const t = task(id, over);
  return { task: t, rolloverCount: t.rolloverCount };
};

type ThisWeek = ReviewDto["thisWeek"];
const week = (over: Partial<ThisWeek>): ThisWeek => ({
  planned: 0,
  finished: 0,
  inProgress: 0,
  overdue: 0,
  byProject: [],
  ...over,
});

describe("headline", () => {
  it("splits the overdue segment so it can be coloured", () => {
    expect(headline(week({ planned: 6, finished: 2, inProgress: 2, overdue: 1 }))).toEqual({
      main: "Finished 2 of 6 planned · 2 in progress",
      overdue: "1 overdue",
    });
  });
});

describe("dayLine", () => {
  it("names the weekday and its ISO index", () => {
    expect(dayLine("2026-11-07")).toBe("Sat, day 6 of 7");
    expect(dayLine("2026-11-02")).toBe("Mon, day 1 of 7");
    expect(dayLine("2026-11-08")).toBe("Sun, day 7 of 7");
  });
});

describe("last week", () => {
  const last = { start: "2026-10-26", end: "2026-11-01", planned: 7, finished: 4, carried: 3, byProject: [] };
  it("formats the heading and line", () => {
    expect(lastWeekHeading(last)).toBe("Last week · Oct 26 – Nov 1");
    expect(lastWeekLine(last)).toBe("Finished 4 of 7 planned. 3 carried over.");
  });
  it("says there is no data when nothing was planned", () => {
    expect(lastWeekLine({ ...last, planned: 0, finished: 0, carried: 0 })).toBe("no data for last week");
  });
});

describe("decidedText", () => {
  it("uses the exact copy", () => {
    expect(decidedText("moved", "Pay rent")).toBe("moved to This week");
    expect(decidedText("kept", "Pay rent")).toBe("kept in Backlog");
    expect(decidedText("deleted", "Pay rent")).toBe("deleted “Pay rent”");
  });
});

describe("nudgeCount", () => {
  it("counts live Backlog tasks rolled over twice or more", () => {
    const tasks = [
      task("a", { rolloverCount: 2 }),
      task("b", { rolloverCount: 3, status: "THIS_WEEK" }),
      task("c", { rolloverCount: 1 }),
      task("d", { rolloverCount: 5, archived: true }),
      task("e", { rolloverCount: 4 }),
    ];
    expect(nudgeCount(tasks)).toBe(2);
  });
});

describe("decidedReducer", () => {
  const a = entry("a");
  const decide = (state: DecidedMap, kind: "moved" | "kept" | "deleted", e = a, index = 0) =>
    decidedReducer(state, { type: "decide", id: e.task.id, kind, entry: e, index });

  it("keeps a decision with no undo window until it is cleared", () => {
    let s = decide({}, "kept");
    s = decidedReducer(s, { type: "line", line: null });
    s = decidedReducer(s, { type: "line", line: { id: 9, label: "something else" } });
    expect(s.a?.kind).toBe("kept");
    expect(decidedReducer(s, { type: "clear", id: "a" })).toEqual({});
  });

  it("arms a move on its undo line and expires it when that line goes", () => {
    let s = decide({}, "moved");
    s = decidedReducer(s, { type: "line", line: null });
    expect(s.a?.lineId).toBeNull();
    s = decidedReducer(s, { type: "line", line: { id: 3, label: "moved “Task a” to This week" } });
    expect(s.a?.lineId).toBe(3);
    expect(decidedReducer(s, { type: "line", line: null })).toEqual({});
    expect(decidedReducer(s, { type: "line", line: { id: 4, label: "deleted “Task b”" } })).toEqual({});
  });

  it("arms a delete on the deleted line", () => {
    let s = decide({}, "deleted");
    s = decidedReducer(s, { type: "line", line: { id: 7, label: "deleted “Task a”" } });
    expect(s.a?.lineId).toBe(7);
  });

  it("returns the same state when a line changes nothing", () => {
    const s = decide({}, "kept");
    expect(decidedReducer(s, { type: "line", line: null })).toBe(s);
  });
});

describe("carriedRows", () => {
  const a = entry("a");
  const b = entry("b", { rolloverCount: 2 });
  const c = entry("c", { status: "THIS_WEEK" });

  it("shows the live board copy of each carried task", () => {
    const live = new Map([
      ["a", { ...a.task, title: "renamed" }],
      ["b", b.task],
      ["c", c.task],
    ]);
    const rows = carriedRows([a, b, c], {}, live);
    expect(rows.map((r) => [r.entry.task.id, r.entry.task.title, r.decided])).toEqual([
      ["a", "renamed", null],
      ["b", "Task b", null],
      ["c", "Task c", null],
    ]);
  });

  it("keeps a carried task moved to This week, showing its current column", () => {
    const live = new Map([["b", { ...b.task, status: "THIS_WEEK" as const, rolledBackAt: null }]]);
    expect(carriedRows([a, b], {}, live).map((r) => [r.entry.task.id, r.entry.task.status])).toEqual([
      ["b", "THIS_WEEK"],
    ]);
  });

  it("uses the review data as is before the board loads", () => {
    expect(carriedRows([a, b], {}, null).map((r) => r.entry.task.id)).toEqual(["a", "b"]);
  });

  it("keeps a decided row in place after it vanished from the refetched review", () => {
    const decided = decidedReducer({}, { type: "decide", id: "b", kind: "deleted", entry: b, index: 1 });
    const live = new Map([
      ["a", a.task],
      ["c", c.task],
    ]);
    const rows = carriedRows([a, c], decided, live);
    expect(rows.map((r) => [r.entry.task.id, r.decided?.kind ?? null])).toEqual([
      ["a", null],
      ["b", "deleted"],
      ["c", null],
    ]);
  });
});

describe("insight text", () => {
  it("states where this week's work came from", () => {
    expect(
      originLine({ carriedIn: 2, finishedCarried: 2, addedThisWeek: 0, finishedNew: 0, addedAfterMonday: 0 }),
    ).toBe("carried in 2 (2 finished) · added 0 (0 finished)");
  });

  it("shows a dash for missing values", () => {
    expect(daysText(null)).toBe("—");
    expect(daysText(1)).toBe("1 day");
    expect(daysText(2.5)).toBe("2.5 days");
    expect(shareText(null)).toBe("—");
    expect(shareText(0.25)).toBe("25%");
  });

  it("sums the 8-week completion and omits it when nothing was planned", () => {
    const week = (planned: number, finished: number, dropped = 0) => ({ weekStart: MONDAY, planned, finished, dropped });
    expect(completionLine([week(5, 3), week(3, 2)])).toBe("completion 63% over 2 weeks");
    expect(completionLine([week(0, 0)])).toBeNull();
    expect(droppedLine([week(5, 3, 1), week(3, 2, 2)])).toBe("3 dropped");
    expect(droppedLine([week(5, 3)])).toBeNull();
  });

  it("labels the current week and dates the rest", () => {
    expect(trendTick(MONDAY, MONDAY)).toBe("this week");
    expect(trendTick("2026-10-05", MONDAY)).toBe("Oct 5");
  });
});
