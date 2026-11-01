import type { Task } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createTaskSchema, sortColumn, updateData, updateTaskSchema, type TaskDto } from "./tasks";

const WEEK = "2026-10-26";

function task(id: string, over: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    title: id,
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
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    ...over,
  };
}

const ids = (ts: TaskDto[]) => ts.map((t) => t.id);

describe("sortColumn", () => {
  it("orders by priority URGENT, HIGH, NONE before anything else", () => {
    const tasks = [
      task("none", { rolledBackAt: WEEK, dueDate: "2026-10-01" }),
      task("high", { priority: "HIGH" }),
      task("urgent", { priority: "URGENT", createdAt: "2026-10-25T00:00:00.000Z" }),
    ];
    expect(ids(sortColumn(tasks, WEEK))).toEqual(["urgent", "high", "none"]);
  });

  it("puts tasks rolled back this week first, ignoring older rollbacks", () => {
    const tasks = [task("plain"), task("old", { rolledBackAt: "2026-10-19" }), task("rolled", { rolledBackAt: WEEK })];
    expect(ids(sortColumn(tasks, WEEK))).toEqual(["rolled", "plain", "old"]);
  });

  it("sorts due date ascending with nulls last, then createdAt ascending", () => {
    const tasks = [
      task("nodue-new", { createdAt: "2026-10-22T00:00:00.000Z" }),
      task("late", { dueDate: "2026-11-05" }),
      task("nodue-old", { createdAt: "2026-10-21T00:00:00.000Z" }),
      task("soon", { dueDate: "2026-10-28" }),
    ];
    expect(ids(sortColumn(tasks, WEEK))).toEqual(["soon", "late", "nodue-old", "nodue-new"]);
  });

  it("does not mutate its input", () => {
    const tasks = [task("b", { priority: "NONE" }), task("a", { priority: "URGENT" })];
    sortColumn(tasks, WEEK);
    expect(ids(tasks)).toEqual(["b", "a"]);
  });
});

describe("task schemas", () => {
  it("defaults priority and checklist on create", () => {
    expect(createTaskSchema.parse({ title: "x" })).toMatchObject({ priority: "NONE", checklist: [], status: "BACKLOG" });
  });

  it("leaves status, priority and checklist undefined on an empty update", () => {
    expect(updateTaskSchema.parse({})).toEqual({});
  });

  it("accepts archived false only", () => {
    expect(updateTaskSchema.safeParse({ archived: false }).success).toBe(true);
    expect(updateTaskSchema.safeParse({ archived: true }).success).toBe(false);
  });

  it("rejects an unknown priority", () => {
    expect(updateTaskSchema.safeParse({ priority: "LOW" }).success).toBe(false);
  });
});

describe("rolledBackAt on update", () => {
  it("accepts a ymd or null and rejects other strings", () => {
    expect(updateTaskSchema.parse({ rolledBackAt: "2026-10-26" })).toEqual({ rolledBackAt: "2026-10-26" });
    expect(updateTaskSchema.parse({ rolledBackAt: null })).toEqual({ rolledBackAt: null });
    expect(updateTaskSchema.safeParse({ rolledBackAt: "Oct 26" }).success).toBe(false);
  });
});

describe("updateData", () => {
  const now = new Date("2026-10-28T03:00:00.000Z");
  const existing = {
    status: "BACKLOG",
    archived: false,
    completedAt: null,
  } as unknown as Task;

  it("applies rolledBackAt after the status reset", () => {
    const data = updateData({ status: "BACKLOG", rolledBackAt: WEEK }, existing, now);
    expect(data.status).toBe("BACKLOG");
    expect(data.rolledBackAt).toEqual(new Date(`${WEEK}T00:00:00.000Z`));
  });

  it("resets rolledBackAt when only status is sent", () => {
    expect(updateData({ status: "THIS_WEEK" }, existing, now).rolledBackAt).toBeNull();
  });

  it("ignores archived false on a task that is not archived", () => {
    const live = { ...existing, status: "DONE" } as unknown as Task;
    const data = updateData({ archived: false }, live, now);
    expect(data).not.toHaveProperty("archived");
    expect(data).not.toHaveProperty("status");
  });

  it("restores an archived task to Backlog", () => {
    const archived = { ...existing, status: "DONE", archived: true } as unknown as Task;
    expect(updateData({ archived: false }, archived, now)).toMatchObject({
      archived: false,
      status: "BACKLOG",
      weekOf: null,
      completedAt: null,
      rolledBackAt: null,
    });
  });
});
