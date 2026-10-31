import { describe, expect, it } from "vitest";
import {
  TIMEZONE,
  currentWeekStart,
  dateToYmd,
  formatWeekRange,
  todayYmd,
  weekRange,
  ymdToDate,
} from "./week";

describe("TIMEZONE", () => {
  it("is Asia/Manila", () => {
    expect(TIMEZONE).toBe("Asia/Manila");
  });
});

describe("currentWeekStart", () => {
  it("returns Monday for a Saturday in Manila", () => {
    expect(currentWeekStart(new Date("2026-10-31T10:00:00Z"))).toBe("2026-10-26");
  });

  it("stays on the old week at Sunday 23:59:59 Manila", () => {
    expect(currentWeekStart(new Date("2026-11-01T15:59:59Z"))).toBe("2026-10-26");
  });

  it("moves to the new week at Monday 00:00 Manila while still Sunday in UTC", () => {
    expect(currentWeekStart(new Date("2026-11-01T16:00:00Z"))).toBe("2026-11-02");
  });

  it("returns the same Monday later on Monday", () => {
    expect(currentWeekStart(new Date("2026-11-02T00:00:00Z"))).toBe("2026-11-02");
  });

  it("crosses the year boundary", () => {
    expect(currentWeekStart(new Date("2026-01-01T00:00:00Z"))).toBe("2025-12-29");
  });
});

describe("todayYmd", () => {
  it("uses the Manila calendar day", () => {
    expect(todayYmd(new Date("2026-10-31T16:30:00Z"))).toBe("2026-11-01");
  });
});

describe("weekRange", () => {
  it("spans Monday to Sunday", () => {
    expect(weekRange(new Date("2026-10-31T10:00:00Z"))).toEqual({
      start: "2026-10-26",
      end: "2026-11-01",
    });
  });
});

describe("formatWeekRange", () => {
  it("formats with an en dash and the end year", () => {
    expect(formatWeekRange({ start: "2026-10-26", end: "2026-11-01" })).toBe(
      "Mon, Oct 26 – Sun, Nov 1, 2026",
    );
  });
});

describe("dateToYmd / ymdToDate", () => {
  it("round-trips a date string", () => {
    expect(dateToYmd(ymdToDate("2026-02-28"))).toBe("2026-02-28");
  });
});
