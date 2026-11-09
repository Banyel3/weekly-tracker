import { describe, expect, it } from "vitest";
import { buildReview } from "./review";
import type { TaskDto } from "./tasks";

const NOW = new Date("2026-10-29T04:00:00Z");
const THIS = "2026-10-26";
const LAST = "2026-10-19";

let seq = 0;
function task(over: Partial<TaskDto> = {}): TaskDto {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `task ${seq}`,
    note: null,
    dueDate: null,
    status: "BACKLOG",
    weekOf: null,
    rolledBackAt: null,
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

const projects = [
  { id: "work", name: "Work", color: "sky" },
  { id: "home", name: "Home", color: "rose" },
];

const tasks: TaskDto[] = [
  task({ status: "DONE", weekOf: THIS, projectId: "work", completedAt: "2026-10-28T16:30:00.000Z" }),
  task({ status: "DONE", weekOf: THIS, projectId: "home", completedAt: "2026-10-26T01:00:00.000Z" }),
  task({ status: "IN_PROGRESS", weekOf: THIS, projectId: "work", dueDate: "2026-10-28" }),
  task({ status: "THIS_WEEK", weekOf: THIS, rolledBackAt: THIS, rolloverCount: 2 }),
  task({ status: "BACKLOG", rolledBackAt: THIS, rolloverCount: 1, projectId: "home", dueDate: "2026-10-30" }),
  task({ status: "BACKLOG", rolledBackAt: LAST, rolloverCount: 3, dueDate: "2026-10-01" }),
  task({ status: "DONE", weekOf: LAST, archived: true, projectId: "work", completedAt: "2026-10-23T02:00:00.000Z" }),
  task({ status: "DONE", weekOf: LAST, archived: true, completedAt: "2026-10-10T02:00:00.000Z" }),
  task({ status: "DONE", weekOf: "2026-10-12", archived: true, dueDate: "2026-10-01" }),
  task({ status: "IN_PROGRESS", weekOf: LAST, archived: true, dueDate: "2026-10-01" }),
];

const carriedIds = tasks.filter((t) => t.rolledBackAt === THIS).map((t) => t.id);

describe("buildReview", () => {
  const review = buildReview(NOW, { tasks, projects, carriedIds });

  it("reports the current week and Manila today", () => {
    expect(review.week).toEqual({ start: THIS, end: "2026-11-01" });
    expect(review.today).toBe("2026-10-29");
  });

  it("counts this week's planned, finished, in progress and overdue", () => {
    expect(review.thisWeek).toMatchObject({ planned: 4, finished: 2, inProgress: 1, overdue: 2 });
  });

  it("groups this week by project with No project last", () => {
    expect(review.thisWeek.byProject).toEqual([
      { projectId: "home", name: "Home", color: "rose", planned: 1, finished: 1 },
      { projectId: "work", name: "Work", color: "sky", planned: 2, finished: 1 },
      { projectId: null, name: "No project", color: "slate", planned: 1, finished: 0 },
    ]);
  });

  it("lists tasks rolled back this Monday regardless of status", () => {
    expect(review.carried.map((c) => [c.task.status, c.rolloverCount])).toEqual([
      ["THIS_WEEK", 2],
      ["BACKLOG", 1],
    ]);
  });

  it("computes last week from archived Done plus this Monday's carried tasks", () => {
    expect(review.lastWeek).toMatchObject({ start: LAST, end: "2026-10-25", planned: 4, finished: 2, carried: 2 });
    expect(review.lastWeek.byProject).toEqual([
      { projectId: "home", name: "Home", color: "rose", planned: 1, finished: 0 },
      { projectId: "work", name: "Work", color: "sky", planned: 1, finished: 1 },
      { projectId: null, name: "No project", color: "slate", planned: 2, finished: 1 },
    ]);
  });

  it("counts a carried task moved to This week as carried even after rolledBackAt was cleared", () => {
    const moved = task({ status: "THIS_WEEK", weekOf: THIS, rolledBackAt: null, rolloverCount: 1 });
    const backlog = task({ status: "BACKLOG", rolledBackAt: THIS });
    const r = buildReview(NOW, { tasks: [moved, backlog], projects, carriedIds: [moved.id, backlog.id, "deleted"] });
    expect(r.carried.map((c) => [c.task.id, c.task.status])).toEqual([
      [moved.id, "THIS_WEEK"],
      [backlog.id, "BACKLOG"],
    ]);
    expect(r.lastWeek.carried).toBe(2);
  });

  it("leaves Future tasks out of planned, overdue and carried, even when overdue by date", () => {
    const future = task({ status: "FUTURE", dueDate: "2026-10-01" });
    const r = buildReview(NOW, { tasks: [future], projects, carriedIds: [future.id] });
    expect(r.thisWeek).toMatchObject({ planned: 0, finished: 0, overdue: 0 });
    expect(r.carried).toEqual([]);
    expect(r.lastWeek).toMatchObject({ planned: 0, carried: 0 });
  });

  it("ignores rolledBackAt without a ROLLED_BACK event for this Monday", () => {
    const r = buildReview(NOW, { tasks: [task({ rolledBackAt: THIS })], projects, carriedIds: [] });
    expect(r.carried).toEqual([]);
  });

  it("buckets finished tasks into the last 7 Manila days", () => {
    expect(review.perDay).toEqual([
      { day: "2026-10-23", finished: 1 },
      { day: "2026-10-24", finished: 0 },
      { day: "2026-10-25", finished: 0 },
      { day: "2026-10-26", finished: 1 },
      { day: "2026-10-27", finished: 0 },
      { day: "2026-10-28", finished: 0 },
      { day: "2026-10-29", finished: 1 },
    ]);
  });

  it("treats a project missing from the list as No project", () => {
    const r = buildReview(NOW, { tasks: [task({ weekOf: THIS, projectId: "gone" })], projects, carriedIds: [] });
    expect(r.thisWeek.byProject).toEqual([
      { projectId: null, name: "No project", color: "slate", planned: 1, finished: 0 },
    ]);
  });

  it("returns zeros for an empty board", () => {
    const r = buildReview(NOW, { tasks: [], projects: [], carriedIds: [] });
    expect(r.thisWeek).toEqual({ planned: 0, finished: 0, inProgress: 0, overdue: 0, byProject: [] });
    expect(r.carried).toEqual([]);
    expect(r.perDay.every((d) => d.finished === 0)).toBe(true);
  });
});
