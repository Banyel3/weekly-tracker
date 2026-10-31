import { describe, expect, it } from "vitest";
import type { ReviewDto } from "./review";
import { buildWeeklySummaryText } from "./summary";
import type { TaskDto } from "./tasks";

function task(title: string, over: Partial<TaskDto> = {}): TaskDto {
  return {
    id: title,
    title,
    note: null,
    dueDate: null,
    status: "BACKLOG",
    weekOf: null,
    rolledBackAt: "2026-10-26",
    projectId: null,
    priority: "NONE",
    checklist: [],
    rolloverCount: 0,
    completedAt: null,
    archived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

function carry(title: string, rolloverCount: number, over: Partial<TaskDto> = {}) {
  return { task: task(title, { rolloverCount, ...over }), rolloverCount };
}

function review(carried: ReviewDto["carried"]): ReviewDto {
  return {
    week: { start: "2026-10-26", end: "2026-11-01" },
    today: "2026-10-30",
    thisWeek: {
      planned: 7,
      finished: 4,
      inProgress: 2,
      overdue: 1,
      byProject: [
        { projectId: "work", name: "Work", color: "sky", planned: 5, finished: 3 },
        { projectId: null, name: "No project", color: "slate", planned: 2, finished: 1 },
      ],
    },
    carried,
    lastWeek: { start: "2026-10-19", end: "2026-10-25", planned: 0, finished: 0, carried: 0, byProject: [] },
    perDay: [],
  };
}

describe("buildWeeklySummaryText", () => {
  it("lists tasks carried over twice or more that are still in Backlog", () => {
    const text = buildWeeklySummaryText(
      review([
        carry("Taxes", 3),
        carry("Once only", 1),
        carry("Picked up again", 2, { status: "THIS_WEEK" }),
        carry("Gym plan", 2),
      ]),
    );
    expect(text).toBe(
      [
        "Week of Oct 26: finished 4 of 7 · 2 in progress · 1 overdue",
        "Work 3/5 · No project 1/2",
        "Carried over twice or more: Taxes, Gym plan",
      ].join("\n"),
    );
  });

  it("omits the carried line when nothing qualifies", () => {
    expect(buildWeeklySummaryText(review([carry("Once only", 1)]))).toBe(
      ["Week of Oct 26: finished 4 of 7 · 2 in progress · 1 overdue", "Work 3/5 · No project 1/2"].join("\n"),
    );
  });

  it("omits the project line when the week is empty", () => {
    const empty = review([]);
    empty.thisWeek = { planned: 0, finished: 0, inProgress: 0, overdue: 0, byProject: [] };
    expect(buildWeeklySummaryText(empty)).toBe("Week of Oct 26: finished 0 of 0 · 0 in progress · 0 overdue");
  });
});
