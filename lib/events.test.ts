import type { Status, Task } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createEvents, eventRows, statusEvents, updateEvents } from "./events";

function row(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Task",
    note: null,
    dueDate: null,
    status: "BACKLOG",
    weekOf: null,
    archived: false,
    rolledBackAt: null,
    priority: "NONE",
    checklist: [],
    rolloverCount: 0,
    completedAt: null,
    projectId: null,
    createdAt: new Date("2026-10-20T00:00:00Z"),
    updatedAt: new Date("2026-10-20T00:00:00Z"),
    ...over,
  };
}

describe("statusEvents", () => {
  const table: [Status | null, Status, string[]][] = [
    [null, "BACKLOG", []],
    [null, "THIS_WEEK", ["PLANNED"]],
    [null, "IN_PROGRESS", ["PLANNED", "STARTED"]],
    [null, "DONE", ["PLANNED", "DONE"]],
    ["BACKLOG", "BACKLOG", []],
    ["BACKLOG", "THIS_WEEK", ["PLANNED"]],
    ["BACKLOG", "IN_PROGRESS", ["PLANNED", "STARTED"]],
    ["BACKLOG", "DONE", ["PLANNED", "DONE"]],
    ["THIS_WEEK", "IN_PROGRESS", ["STARTED"]],
    ["THIS_WEEK", "DONE", ["DONE"]],
    ["THIS_WEEK", "BACKLOG", ["UNPLANNED"]],
    ["IN_PROGRESS", "THIS_WEEK", []],
    ["IN_PROGRESS", "DONE", ["DONE"]],
    ["IN_PROGRESS", "BACKLOG", ["UNPLANNED"]],
    ["DONE", "IN_PROGRESS", ["REOPENED", "STARTED"]],
    ["DONE", "THIS_WEEK", ["REOPENED"]],
    ["DONE", "BACKLOG", ["REOPENED", "UNPLANNED"]],
    ["DONE", "DONE", []],
    [null, "FUTURE", []],
    ["BACKLOG", "FUTURE", []],
    ["FUTURE", "BACKLOG", []],
    ["FUTURE", "THIS_WEEK", ["PLANNED"]],
    ["FUTURE", "IN_PROGRESS", ["PLANNED", "STARTED"]],
    ["FUTURE", "DONE", ["PLANNED", "DONE"]],
    ["THIS_WEEK", "FUTURE", ["UNPLANNED"]],
    ["IN_PROGRESS", "FUTURE", ["UNPLANNED"]],
    ["DONE", "FUTURE", ["REOPENED", "UNPLANNED"]],
  ];
  it.each(table)("%s → %s emits %j", (from, to, types) => {
    expect(statusEvents(from, to)).toEqual(types);
  });
});

describe("createEvents", () => {
  it("always records CREATED, then the planning events for the starting column", () => {
    expect(createEvents("BACKLOG").map((e) => e.type)).toEqual(["CREATED"]);
    expect(createEvents("IN_PROGRESS")).toEqual([
      { type: "CREATED", to: "IN_PROGRESS" },
      { type: "PLANNED", to: "IN_PROGRESS" },
      { type: "STARTED", to: "IN_PROGRESS" },
    ]);
  });
});

describe("updateEvents", () => {
  it("carries the status names on status events", () => {
    expect(updateEvents({ status: "DONE" }, row({ status: "THIS_WEEK" }))).toEqual([
      { type: "DONE", from: "THIS_WEEK", to: "DONE" },
    ]);
  });

  it("records nothing for edits that do not move or reschedule", () => {
    expect(updateEvents({ title: "x", projectId: "p", status: "THIS_WEEK" }, row({ status: "THIS_WEEK" }))).toEqual([]);
  });

  it("records a due date change as RESCHEDULED with ymd or none", () => {
    expect(updateEvents({ dueDate: "2026-11-05" }, row())).toEqual([
      { type: "RESCHEDULED", from: "none", to: "2026-11-05" },
    ]);
    expect(updateEvents({ dueDate: null }, row({ dueDate: new Date("2026-11-05T00:00:00Z") }))).toEqual([
      { type: "RESCHEDULED", from: "2026-11-05", to: "none" },
    ]);
    expect(updateEvents({ dueDate: "2026-11-05" }, row({ dueDate: new Date("2026-11-05T00:00:00Z") }))).toEqual([]);
  });

  it("records a restore as RESTORED only, even with a status in the patch", () => {
    expect(updateEvents({ archived: false, status: "THIS_WEEK" }, row({ archived: true, status: "DONE" }))).toEqual([
      { type: "RESTORED" },
    ]);
  });

  it("ignores archived:false on a live task", () => {
    expect(updateEvents({ archived: false }, row())).toEqual([]);
  });
});

describe("eventRows", () => {
  it("stamps weekOf with the Manila week start of the event time", () => {
    const sundayNightUtc = new Date("2026-11-01T16:30:00Z");
    const [first] = eventRows([{ taskId: "t1", type: "ROLLED_BACK" }], sundayNightUtc);
    expect(first).toMatchObject({ taskId: "t1", at: sundayNightUtc, from: null, to: null });
    expect(first.weekOf).toEqual(new Date("2026-11-02T00:00:00Z"));
  });

  it("uses an explicit at over now", () => {
    const at = new Date("2026-10-20T03:00:00Z");
    const [first] = eventRows([{ taskId: "t1", type: "DONE", at }], new Date("2026-11-03T00:00:00Z"));
    expect(first.weekOf).toEqual(new Date("2026-10-19T00:00:00Z"));
  });
});
