import { describe, expect, it } from "vitest";
import { dotProgress, guideLabels, indexFromScroll, nextColumnFirst, pageStart } from "./carousel";

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

describe("guideLabels in pairs", () => {
  it("names the pair and the columns either side of it", () => {
    expect(guideLabels(0, 2)).toEqual({ left: null, current: "Backlog · This week", right: "In progress" });
    expect(guideLabels(1, 2)).toEqual({ left: null, current: "Backlog · This week", right: "In progress" });
    expect(guideLabels(2, 2)).toEqual({ left: "This week", current: "In progress · Done", right: null });
    expect(guideLabels(3, 2)).toEqual({ left: "This week", current: "In progress · Done", right: null });
  });
});

describe("pageStart", () => {
  it("is the column itself one at a time", () => {
    expect([0, 1, 2, 3].map((i) => pageStart(i, 1))).toEqual([0, 1, 2, 3]);
  });

  it("is the first column of the pair two at a time", () => {
    expect([0, 1, 2, 3].map((i) => pageStart(i, 2))).toEqual([0, 0, 2, 2]);
  });

  it("clamps out-of-range indexes", () => {
    expect(pageStart(-1, 2)).toBe(0);
    expect(pageStart(9, 2)).toBe(2);
    expect(pageStart(9, 1)).toBe(3);
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

describe("dotProgress", () => {
  it("is the fractional page under the centre", () => {
    expect(dotProgress(0, 300, 4)).toBe(0);
    expect(dotProgress(450, 300, 4)).toBe(1.5);
    expect(dotProgress(900, 300, 4)).toBe(3);
  });

  it("clamps overscroll at both ends", () => {
    expect(dotProgress(-40, 300, 4)).toBe(0);
    expect(dotProgress(1200, 300, 4)).toBe(3);
  });

  it("is 0 before the panels are measured", () => {
    expect(dotProgress(120, 0, 4)).toBe(0);
  });
});
