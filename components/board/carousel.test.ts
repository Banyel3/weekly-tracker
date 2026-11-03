import { describe, expect, it } from "vitest";
import { guideLabels, indexFromScroll, nextColumnFirst } from "./carousel";

describe("guideLabels", () => {
  it("names the neighbours of each column", () => {
    expect(guideLabels(0)).toEqual({ left: null, current: "Backlog", right: "This week" });
    expect(guideLabels(1)).toEqual({ left: "Backlog", current: "This week", right: "In progress" });
    expect(guideLabels(2)).toEqual({ left: "This week", current: "In progress", right: "Done" });
    expect(guideLabels(3)).toEqual({ left: "In progress", current: "Done", right: null });
  });

  it("clamps out-of-range indexes", () => {
    expect(guideLabels(-1).current).toBe("Backlog");
    expect(guideLabels(9).current).toBe("Done");
  });
});

describe("indexFromScroll", () => {
  it("rounds scroll position to the nearest page", () => {
    expect(indexFromScroll(0, 354, 4)).toBe(0);
    expect(indexFromScroll(170, 354, 4)).toBe(0);
    expect(indexFromScroll(180, 354, 4)).toBe(1);
    expect(indexFromScroll(708, 354, 4)).toBe(2);
    expect(indexFromScroll(1062, 354, 4)).toBe(3);
  });

  it("clamps to the column range and survives a zero page width", () => {
    expect(indexFromScroll(5000, 354, 4)).toBe(3);
    expect(indexFromScroll(-40, 354, 4)).toBe(0);
    expect(indexFromScroll(100, 0, 4)).toBe(0);
  });
});

describe("nextColumnFirst", () => {
  it("puts the column to the right first, then the rest in board order", () => {
    expect(nextColumnFirst("BACKLOG")).toEqual(["THIS_WEEK", "BACKLOG", "IN_PROGRESS", "DONE"]);
    expect(nextColumnFirst("THIS_WEEK")).toEqual(["IN_PROGRESS", "BACKLOG", "THIS_WEEK", "DONE"]);
    expect(nextColumnFirst("IN_PROGRESS")).toEqual(["DONE", "BACKLOG", "THIS_WEEK", "IN_PROGRESS"]);
  });

  it("wraps Done around to Backlog", () => {
    expect(nextColumnFirst("DONE")).toEqual(["BACKLOG", "THIS_WEEK", "IN_PROGRESS", "DONE"]);
  });
});
