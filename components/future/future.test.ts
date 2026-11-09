import { describe, expect, it } from "vitest";
import type { TaskDto } from "../../lib/tasks";
import { calendarTasks } from "../calendar/calendar";
import { STATUS_OPTIONS, statusLabel } from "../board/status";
import { createUndoSlot } from "../useUndo";
import { futureRows, splitCounts } from "./future";

const task = (over: Partial<TaskDto>) =>
  ({
    id: "t",
    title: "Plan the offsite",
    status: "FUTURE",
    archived: false,
    dueDate: null,
    projectId: null,
    priority: "NONE",
    createdAt: "2026-11-01T00:00:00.000Z",
    ...over,
  }) as TaskDto;

describe("futureRows", () => {
  it("lists dated tasks first by due date, then undated ones by creation order", () => {
    const tasks = [
      task({ id: "undated-late", createdAt: "2026-11-05T00:00:00.000Z" }),
      task({ id: "dec", dueDate: "2026-12-01" }),
      task({ id: "board", status: "BACKLOG", dueDate: "2026-11-20" }),
      task({ id: "undated-early", createdAt: "2026-11-02T00:00:00.000Z", priority: "URGENT" }),
      task({ id: "nov", dueDate: "2026-11-20", createdAt: "2026-11-04T00:00:00.000Z" }),
      task({ id: "nov-first", dueDate: "2026-11-20", createdAt: "2026-11-03T00:00:00.000Z" }),
    ];
    expect(futureRows(tasks).map((t) => t.id)).toEqual(["nov-first", "nov", "dec", "undated-early", "undated-late"]);
  });
});

describe("splitCounts", () => {
  it("splits the live count into Board and Future badges without counting a task twice", () => {
    const tasks = [task({ id: "a" }), task({ id: "b", dueDate: "2026-12-01" }), task({ id: "c", status: "BACKLOG" })];
    // The client's live count holds every live task, Future included.
    expect(splitCounts({ live: 7, archived: 3, nudges: 1 }, tasks)).toEqual({ live: 5, archived: 3, nudges: 1, future: 2 });
  });

  it("moves one task from the Future badge to the Board badge when it is planned", () => {
    const counts = { live: 2, archived: 0, nudges: 0 };
    const tasks = [task({ id: "a" }), task({ id: "b", status: "BACKLOG" })];
    expect(splitCounts(counts, tasks)).toMatchObject({ live: 1, future: 1 });
    expect(splitCounts(counts, [{ ...tasks[0], status: "THIS_WEEK" }, tasks[1]])).toMatchObject({ live: 2, future: 0 });
  });
});

describe("Future on the calendar", () => {
  it("includes Future tasks with a due date and leaves undated ones out", () => {
    const tasks = [task({ id: "dated", dueDate: "2026-11-20" }), task({ id: "undated" })];
    expect(calendarTasks(tasks, null, "2026-11-01", "2026-11-30").map((t) => t.id)).toEqual(["dated"]);
  });
});

describe("the dialog's status options", () => {
  it("offer Future beside the four columns", () => {
    expect(STATUS_OPTIONS.map((o) => o.status)).toEqual(["FUTURE", "BACKLOG", "THIS_WEEK", "IN_PROGRESS", "DONE"]);
    expect(statusLabel("FUTURE")).toBe("Future");
  });
});

describe("move to This week from the Future list", () => {
  it("removes the row, and undo puts it back in its place", async () => {
    let tasks = [task({ id: "a", dueDate: "2026-11-20" }), task({ id: "b" }), task({ id: "c" })];
    const replace = (next: TaskDto) => (tasks = tasks.map((t) => (t.id === next.id ? next : t)));
    const slot = createUndoSlot(() => {}, 5000);
    const before = tasks[1];
    // What useBoard.moveTask does: show the server's answer, then offer undo back to the old copy.
    replace({ ...before, status: "THIS_WEEK" });
    slot.register({ label: "moved", undo: () => void replace(before) });
    expect(futureRows(tasks).map((t) => t.id)).toEqual(["a", "c"]);
    await slot.undo();
    expect(futureRows(tasks).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});
