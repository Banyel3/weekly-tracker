import { describe, expect, it } from "vitest";
import { isoWeekday, pace, perDayBars, perDayLabel, percent, wipLine } from "./stats";

describe("isoWeekday", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-03")).toBe(2);
    expect(isoWeekday("2026-11-08")).toBe(7);
  });
});

describe("pace", () => {
  it("projects finished tasks over seven days", () => {
    expect(pace(3, 10, "2026-10-31")).toEqual({ day: "day 6 of 7", pace: "on pace for 4" });
    expect(pace(1, 4, "2026-11-02")).toEqual({ day: "day 1 of 7", pace: null });
    expect(pace(0, 4, "2026-11-04")).toEqual({ day: "day 3 of 7", pace: "on pace for 0" });
  });

  it("says nothing is planned when the week is empty", () => {
    expect(pace(0, 0, "2026-11-04")).toEqual({ day: "day 3 of 7", pace: "nothing planned yet" });
  });
});

describe("percent", () => {
  it("rounds and guards an empty week", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});

describe("perDayBars", () => {
  const perDay = [
    { day: "2026-10-28", finished: 0 },
    { day: "2026-10-29", finished: 2 },
    { day: "2026-10-30", finished: 0 },
    { day: "2026-10-31", finished: 1 },
    { day: "2026-11-01", finished: 0 },
    { day: "2026-11-02", finished: 3 },
    { day: "2026-11-03", finished: 1 },
  ];

  it("labels each day and marks today", () => {
    const bars = perDayBars(perDay, "2026-11-03");
    expect(bars.map((b) => b.initial).join("")).toBe("WTFSSMT");
    expect(bars.filter((b) => b.today).map((b) => b.day)).toEqual(["2026-11-03"]);
    expect(bars.map((b) => b.finished)).toEqual([0, 2, 0, 1, 0, 3, 1]);
  });

  it("reads the values out for screen readers", () => {
    expect(perDayLabel(perDayBars(perDay, "2026-11-03"))).toBe(
      "Finished per day: Wed 0, Thu 2, Fri 0, Sat 1, Sun 0, Mon 3, Tue 1",
    );
  });
});

describe("wipLine", () => {
  it("nudges when over the limit and counts room otherwise", () => {
    expect(wipLine(4)).toBe("finish one before starting");
    expect(wipLine(1)).toBe("room for 2 more");
    expect(wipLine(3)).toBe("room for 0 more");
  });
});
