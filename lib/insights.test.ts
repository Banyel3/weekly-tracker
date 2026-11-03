import type { EventType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildInsights, carriedTaskIds, median, type InsightEvent } from "./insights";
import type { TaskDto } from "./tasks";

const NOW = new Date("2026-11-05T04:00:00Z");
const WEEK = "2026-11-02";
const LAST = "2026-10-26";

function task(id: string, over: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    title: id,
    note: null,
    dueDate: null,
    status: "THIS_WEEK",
    weekOf: WEEK,
    rolledBackAt: null,
    projectId: null,
    priority: "NONE",
    checklist: [],
    rolloverCount: 0,
    completedAt: null,
    archived: false,
    createdAt: "2026-10-20T04:00:00.000Z",
    updatedAt: "2026-10-20T04:00:00.000Z",
    ...over,
  };
}

function ev(taskId: string, type: EventType, at: string, weekOf: string | null = null): InsightEvent {
  return { taskId, type, at, weekOf, from: null, to: null };
}

const build = (tasks: TaskDto[], events: InsightEvent[]) => buildInsights(NOW, { tasks, events });

describe("origin", () => {
  it("shows the owner's case: two tasks from last week, rolled back Monday, finished this week", () => {
    const tasks = ["a", "b"].map((id) => task(id, { status: "DONE", createdAt: "2026-10-27T02:00:00.000Z" }));
    const events = ["a", "b"].flatMap((id) => [
      ev(id, "CREATED", "2026-10-27T02:00:00Z"),
      ev(id, "PLANNED", "2026-10-27T02:00:00Z"),
      ev(id, "ROLLED_BACK", "2026-11-01T16:00:00Z", WEEK),
      ev(id, "PLANNED", "2026-11-03T02:00:00Z"),
      ev(id, "DONE", "2026-11-03T03:00:00Z"),
    ]);
    const insights = build(tasks, events);
    expect(insights.origin).toEqual({
      carriedIn: 2,
      addedThisWeek: 0,
      finishedCarried: 2,
      finishedNew: 0,
      addedAfterMonday: 0,
    });
    expect(insights.signals.midWeekRatio).toBe(0);
    expect(insights.pattern).toBe("steady week: finished 2 of 2");
  });

  it("does not count a carried task that was deleted", () => {
    const events = [ev("gone", "ROLLED_BACK", "2026-11-01T16:00:00Z", WEEK), ev("gone", "DELETED", "2026-11-03T03:00:00Z")];
    expect(carriedTaskIds(events, WEEK)).toEqual([]);
    expect(carriedTaskIds([...events, ev("gone", "RESTORED", "2026-11-03T04:00:00Z")], WEEK)).toEqual(["gone"]);
  });

  it("counts new work arriving after Monday, not old work planned late", () => {
    const tasks = [
      task("wed", { status: "DONE", createdAt: "2026-11-04T02:00:00.000Z" }),
      task("mon", { status: "IN_PROGRESS", createdAt: "2026-11-02T01:00:00.000Z" }),
      task("old"),
      task("backlog", { status: "BACKLOG", weekOf: null, createdAt: "2026-11-03T01:00:00.000Z" }),
    ];
    const events = [
      ev("wed", "CREATED", "2026-11-04T02:00:00Z"),
      ev("wed", "PLANNED", "2026-11-04T02:00:00Z"),
      ev("wed", "DONE", "2026-11-04T05:00:00Z"),
      ev("mon", "CREATED", "2026-11-02T01:00:00Z"),
      ev("mon", "PLANNED", "2026-11-01T16:30:00Z"),
      ev("old", "PLANNED", "2026-11-03T10:00:00Z"),
      ev("backlog", "CREATED", "2026-11-03T01:00:00Z"),
    ];
    expect(build(tasks, events).origin).toEqual({
      carriedIn: 0,
      addedThisWeek: 2,
      finishedCarried: 0,
      finishedNew: 1,
      addedAfterMonday: 1,
    });
  });

  it("falls back to the task's createdAt when its CREATED event is outside the window", () => {
    expect(build([task("x", { createdAt: "2026-11-02T03:00:00.000Z" })], []).origin.addedThisWeek).toBe(1);
  });
});

describe("flow", () => {
  it("takes medians of added→done and last started→done over this week's finishes", () => {
    const tasks = [task("a"), task("b"), task("c")];
    const events = [
      ev("a", "CREATED", "2026-10-30T04:00:00Z"),
      ev("a", "STARTED", "2026-11-01T04:00:00Z"),
      ev("a", "STARTED", "2026-11-03T04:00:00Z"),
      ev("a", "DONE", "2026-11-03T16:00:00Z"),
      ev("b", "CREATED", "2026-11-02T04:00:00Z"),
      ev("b", "DONE", "2026-11-04T04:00:00Z"),
      ev("c", "CREATED", "2026-10-01T04:00:00Z"),
      ev("c", "DONE", "2026-11-03T04:00:00Z"),
      ev("c", "REOPENED", "2026-11-03T05:00:00Z"),
    ];
    expect(build(tasks, events).flow).toEqual({
      medianCreatedToDoneDays: 3.3,
      medianInProgressDays: 0.5,
      reopened: 1,
    });
  });

  it("returns null medians when nothing finished", () => {
    expect(build([], []).flow).toEqual({ medianCreatedToDoneDays: null, medianInProgressDays: null, reopened: 0 });
  });

  it("averages even-sized sets", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("signals", () => {
  const tasks = [
    task("late", { status: "DONE", dueDate: "2026-11-01" }),
    task("early", { status: "DONE", dueDate: "2026-11-10" }),
    task("p3"),
    task("p4", { createdAt: "2026-11-02T01:00:00.000Z" }),
    task("stuck", { status: "BACKLOG", weekOf: null, rolloverCount: 2, createdAt: "2026-10-06T04:00:00.000Z" }),
    task("gone", { archived: true, weekOf: LAST, rolloverCount: 3 }),
  ];
  const events = [
    ev("late", "DONE", "2026-11-04T03:00:00Z"),
    ev("early", "DONE", "2026-11-04T03:00:00Z"),
    ev("p3", "RESCHEDULED", "2026-11-03T03:00:00Z"),
    ev("p3", "RESCHEDULED", "2026-11-04T03:00:00Z"),
    ev("p4", "RESCHEDULED", "2026-10-28T03:00:00Z"),
    ev("p4", "PLANNED", "2026-11-04T03:00:00Z"),
  ];

  it("reports reschedules, overdue days, rolled twice, oldest backlog and mid-week share", () => {
    expect(build(tasks, events).signals).toEqual({
      reschedules: 2,
      reschedulesPerPlanned: 0.5,
      avgOverdueDaysBeforeDone: 1.5,
      rolledTwice: 1,
      oldestBacklogAgeDays: 30,
      midWeekRatio: 0.25,
    });
  });

  it("uses null where there is nothing to measure", () => {
    expect(build([], []).signals).toEqual({
      reschedules: 0,
      reschedulesPerPlanned: null,
      avgOverdueDaysBeforeDone: null,
      rolledTwice: 0,
      oldestBacklogAgeDays: null,
      midWeekRatio: null,
    });
  });
});

describe("trend", () => {
  it("covers 8 weeks oldest to newest ending with this week", () => {
    const weeks = build([], []).trend.map((w) => w.weekStart);
    expect(weeks).toEqual([
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
    ]);
  });

  it("counts planned from PLANNED events and task weeks, finished without same-week reopens", () => {
    const tasks = [
      task("archived", { status: "DONE", archived: true, weekOf: LAST }),
      task("now", { status: "DONE" }),
      task("undone"),
    ];
    const events = [
      ev("archived", "DONE", "2026-10-28T03:00:00Z"),
      ev("deleted", "PLANNED", "2026-10-27T03:00:00Z"),
      ev("deleted", "DONE", "2026-10-29T03:00:00Z"),
      ev("deleted", "REOPENED", "2026-11-02T03:00:00Z"),
      ev("now", "PLANNED", "2026-11-02T03:00:00Z"),
      ev("now", "DONE", "2026-11-03T03:00:00Z"),
      ev("now", "REOPENED", "2026-11-03T04:00:00Z"),
      ev("now", "DONE", "2026-11-03T05:00:00Z"),
      ev("undone", "DONE", "2026-11-03T03:00:00Z"),
      ev("undone", "REOPENED", "2026-11-03T04:00:00Z"),
    ];
    const trend = build(tasks, events).trend;
    expect(trend[6]).toEqual({ weekStart: LAST, planned: 2, finished: 2, dropped: 0 });
    expect(trend[7]).toEqual({ weekStart: WEEK, planned: 2, finished: 1, dropped: 0 });
  });

  it("moves deleted tasks out of planned, finished and flow into dropped", () => {
    const tasks = [task("kept", { status: "DONE" })];
    const events = [
      ev("kept", "CREATED", "2026-11-02T01:00:00Z"),
      ev("kept", "PLANNED", "2026-11-02T01:00:00Z"),
      ev("kept", "DONE", "2026-11-03T01:00:00Z"),
      ev("old", "PLANNED", "2026-10-27T01:00:00Z"),
      ev("old", "DONE", "2026-10-28T01:00:00Z"),
      ev("old", "DELETED", "2026-11-02T05:00:00Z"),
      ev("gone", "CREATED", "2026-10-01T01:00:00Z"),
      ev("gone", "PLANNED", "2026-11-02T01:00:00Z"),
      ev("gone", "DONE", "2026-11-02T03:00:00Z"),
      ev("gone", "DELETED", "2026-11-03T05:00:00Z"),
    ];
    const insights = build(tasks, events);
    expect(insights.trend[6]).toEqual({ weekStart: LAST, planned: 0, finished: 0, dropped: 1 });
    expect(insights.trend[7]).toEqual({ weekStart: WEEK, planned: 1, finished: 1, dropped: 1 });
    expect(insights.flow.medianCreatedToDoneDays).toBe(1);
  });

  it("matches the headline for the current week", () => {
    const tasks = [task("a", { status: "DONE" }), task("b")];
    const events = [ev("x", "PLANNED", "2026-11-02T03:00:00Z"), ev("x", "UNPLANNED", "2026-11-02T04:00:00Z")];
    expect(build(tasks, events).trend[7]).toEqual({ weekStart: WEEK, planned: 2, finished: 1, dropped: 0 });
  });
});

describe("pattern", () => {
  const done = (id: string, at: string) => ev(id, "DONE", at);
  const tueThu = [
    done("a", "2026-10-20T03:00:00Z"),
    done("b", "2026-10-27T03:00:00Z"),
    done("c", "2026-11-03T03:00:00Z"),
    done("d", "2026-10-22T03:00:00Z"),
    done("e", "2026-10-29T03:00:00Z"),
    done("f", "2026-10-19T03:00:00Z"),
  ];
  const waiting = ["w1", "w2"].map((id) => task(id, { status: "IN_PROGRESS", createdAt: "2026-10-01T00:00:00.000Z" }));
  const waitEvents = waiting.map((t) => ev(t.id, "STARTED", "2026-11-03T03:00:00Z"));

  it("1: names the two weekdays that hold half the finishes", () => {
    expect(build([], tueThu).pattern).toBe("you finish most on Tue and Thu");
  });

  it("1 wins over 2", () => {
    expect(build(waiting, [...tueThu, ...waitEvents]).pattern).toBe("you finish most on Tue and Thu");
  });

  it("1 needs enough finishes and two days holding half of them", () => {
    expect(build([], tueThu.slice(0, 4)).pattern).toBeNull();
    const spread = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((d, i) =>
      done(`s${i}`, `${d}T03:00:00Z`),
    );
    expect(build([], spread).pattern).toBeNull();
  });

  it("2: counts tasks started this week two or more weeks after they were added", () => {
    expect(build(waiting, waitEvents).pattern).toBe("2 tasks waited 2+ weeks before you started them");
    expect(build(waiting.slice(0, 1), waitEvents).pattern).toBe("steady week: finished 0 of 1");
  });

  it("3: half the week added after Monday, with at least four planned", () => {
    const four = ["m1", "m2", "m3", "m4"].map((id) => task(id, { createdAt: "2026-11-02T01:00:00.000Z" }));
    const late = [ev("m1", "PLANNED", "2026-11-03T03:00:00Z"), ev("m2", "PLANNED", "2026-11-04T03:00:00Z")];
    expect(build(four, late).pattern).toBe("half of this week's tasks were added after Monday");
    expect(build(four.slice(0, 3), late).pattern).toBe("steady week: finished 0 of 3");
  });

  it("4 or null", () => {
    expect(build([task("x", { status: "DONE" })], []).pattern).toBe("steady week: finished 1 of 1");
    expect(build([], []).pattern).toBeNull();
  });
});
