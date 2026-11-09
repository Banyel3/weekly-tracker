import { describe, expect, it } from "vitest";
import { buildMorningDigest, digestSections, type DigestData, type DigestTask } from "./digestText";
import { shiftYmd, type WeekRange } from "./week";

// ISO week of Mon 2026-11-02 .. Sun 2026-11-08.
const WEEK: WeekRange = { start: "2026-11-02", end: "2026-11-08" };

let seq = 0;
function task(title: string, dueDate: string | null, over: Partial<DigestTask> = {}): DigestTask {
  seq += 1;
  return {
    id: `t${seq}`,
    title,
    dueDate,
    status: "THIS_WEEK",
    priority: "NONE",
    createdAt: `2026-11-01T00:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    projectName: null,
    ...over,
  };
}

function data(today: string, tasks: DigestTask[], over: Partial<DigestData> = {}): DigestData {
  return { today, week: WEEK, tasks, inProgress: 0, openThisWeek: tasks.length, carried: 0, ...over };
}

describe("buildMorningDigest", () => {
  it("renders every section in the exact format", () => {
    const text = buildMorningDigest(
      data(
        "2026-11-04",
        [
          task("Renew passport", "2026-11-02", { projectName: "Home" }),
          task("Call bank", "2026-11-04", { projectName: "Money" }),
          task("Send invoice", "2026-11-05"),
          task("Book dentist", "2026-11-07"),
          task("Water plants", "2026-11-06"),
        ],
        { inProgress: 1, openThisWeek: 4, carried: 2 },
      ),
    );
    expect(text).toBe(
      [
        "Good morning · Wed Nov 4 · day 3 of 7",
        "",
        "Overdue",
        "• Renew passport · Home — due Mon, 2d late",
        "",
        "Due today",
        "• Call bank · Money",
        "",
        "Due tomorrow",
        "• Send invoice",
        "",
        "Later this week",
        "• Fri: Water plants",
        "• Sat: Book dentist",
        "",
        "In progress 1/3 · 4 open this week · 2 carried from last week",
      ].join("\n"),
    );
  });

  it("writes 1d late and 3d late", () => {
    const text = buildMorningDigest(data("2026-11-05", [task("A", "2026-11-04"), task("B", "2026-11-02")]));
    expect(text).toContain("• B — due Mon, 3d late\n• A — due Wed, 1d late");
  });

  it("appends the project only when the task has one", () => {
    const text = buildMorningDigest(data("2026-11-04", [task("With", "2026-11-04", { projectName: "Work" }), task("Without", "2026-11-04")]));
    expect(text).toContain("• With · Work\n• Without\n");
  });

  it("orders by due date, then priority, then createdAt", () => {
    const text = buildMorningDigest(
      data("2026-11-04", [
        task("none-old", "2026-11-04"),
        task("high", "2026-11-04", { priority: "HIGH" }),
        task("urgent", "2026-11-04", { priority: "URGENT" }),
        task("none-new", "2026-11-04"),
        task("earlier", "2026-11-03"),
      ]),
    );
    expect(text).toContain("Due today\n• urgent\n• high\n• none-old\n• none-new");
    expect(text.indexOf("earlier")).toBeLessThan(text.indexOf("urgent"));
  });

  it("omits later this week on Saturday and Sunday", () => {
    const sat = buildMorningDigest(data("2026-11-07", [task("Sun task", "2026-11-08"), task("Today", "2026-11-07")]));
    expect(sat).toContain("Due tomorrow\n• Sun task");
    expect(sat).not.toContain("Later this week");
    const sun = buildMorningDigest(data("2026-11-08", [task("Next Mon", "2026-11-09"), task("Next Tue", "2026-11-10")]));
    expect(sun).toContain("Due tomorrow\n• Next Mon");
    expect(sun).not.toContain("Later this week");
    expect(sun).not.toContain("Next Tue");
  });

  it("numbers Monday day 1 and Sunday day 7", () => {
    expect(buildMorningDigest(data("2026-11-02", [task("x", "2026-11-02")]))).toMatch(/^Good morning · Mon Nov 2 · day 1 of 7\n/);
    expect(buildMorningDigest(data("2026-11-08", [task("x", "2026-11-08")]))).toMatch(/^Good morning · Sun Nov 8 · day 7 of 7\n/);
  });

  it("sends a quiet-day note with later this week and the footer", () => {
    const text = buildMorningDigest(
      data("2026-11-03", [task("Later one", "2026-11-06", { projectName: "Home" }), task("Undated", null)], {
        inProgress: 0,
        openThisWeek: 2,
      }),
    );
    expect(text).toBe(
      [
        "Good morning · Tue Nov 3 · day 2 of 7",
        "",
        "Nothing due today · 2 open this week",
        "",
        "Later this week",
        "• Fri: Later one · Home",
        "",
        "In progress 0/3 · 2 open this week",
      ].join("\n"),
    );
  });

  it("sends the easy-day note on an empty board", () => {
    const text = buildMorningDigest(data("2026-11-04", [task("Someday", null, { status: "BACKLOG" })], { openThisWeek: 0 }));
    expect(text).toBe("Good morning · Wed Nov 4 · day 3 of 7\n\nNothing planned this week. Easy day.");
  });

  it("lists at most 10 per section, then … and N more", () => {
    const tasks = Array.from({ length: 13 }, (_, i) => task(`Late ${String(i).padStart(2, "0")}`, "2026-11-03"));
    const text = buildMorningDigest(data("2026-11-04", tasks));
    expect(text).toContain("• Late 09 — due Tue, 1d late\n… and 3 more");
    expect(text).not.toContain("Late 10");
  });

  it("stays under 4096 characters with 60 overdue tasks", () => {
    const tasks = Array.from({ length: 60 }, (_, i) => task(`Overdue task number ${i} `.padEnd(200, "x"), shiftYmd("2026-11-04", -1 - (i % 9)), { projectName: "A forty character project name 012345678" }));
    const text = buildMorningDigest(data("2026-11-04", tasks));
    expect(text.length).toBeLessThan(4096);
    expect(text).toContain("… and 50 more");
  });

  it("shrinks the per-section cap when long titles would pass 4096 characters", () => {
    const long = (n: string, due: string) => task(n.padEnd(200, "y"), due, { projectName: "P".repeat(40) });
    const tasks = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-07"].flatMap((due) =>
      Array.from({ length: 12 }, (_, i) => long(`${due} #${i}`, due)),
    );
    const text = buildMorningDigest(data("2026-11-04", tasks));
    expect(text.length).toBeLessThanOrEqual(4096);
    for (const heading of ["Overdue", "Due today", "Due tomorrow", "Later this week"]) expect(text).toContain(heading);
    expect(text).toMatch(/… and \d+ more$/m);
  });
});

describe("digestSections with Future tasks", () => {
  it("lists a Future task due tomorrow under due tomorrow, across the week boundary", () => {
    const future = task("Plan the sprint", "2026-11-09", { status: "FUTURE" });
    const sections = digestSections(data("2026-11-08", [future]));
    expect(sections.dueTomorrow.map((t) => t.id)).toEqual([future.id]);
    expect(buildMorningDigest(data("2026-11-08", [future], { openThisWeek: 0 }))).toContain("Due tomorrow\n• Plan the sprint");
  });
});
