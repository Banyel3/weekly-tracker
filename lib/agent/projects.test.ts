import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { project: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() } },
}));

vi.mock("../db", () => ({ prisma }));

import { findOrCreateProjectByName, findProjectByName, nextProjectColor } from "./projects";

beforeEach(() => vi.clearAllMocks());

const home = { id: "p1", name: "Home", color: "rose", createdAt: new Date() };

describe("findProjectByName", () => {
  it("matches the trimmed name case-insensitively", async () => {
    prisma.project.findFirst.mockResolvedValue(home);
    expect(await findProjectByName("  home ")).toEqual({ id: "p1", name: "Home", color: "rose" });
    expect(prisma.project.findFirst).toHaveBeenCalledWith({ where: { name: { equals: "home", mode: "insensitive" } } });
  });
});

describe("findOrCreateProjectByName", () => {
  it("returns an existing project without creating", async () => {
    prisma.project.findFirst.mockResolvedValue(home);
    expect((await findOrCreateProjectByName("HOME")).id).toBe("p1");
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("creates a missing project with the first unused colour", async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    prisma.project.findMany.mockResolvedValue([{ color: "rose" }, { color: "lime" }]);
    prisma.project.create.mockImplementation(async ({ data }) => ({ id: "p2", createdAt: new Date(), ...data }));
    const project = await findOrCreateProjectByName(" Work ");
    expect(prisma.project.create).toHaveBeenCalledWith({ data: { name: "Work", color: "amber" } });
    expect(project).toEqual({ id: "p2", name: "Work", color: "amber" });
  });

  it("reuses the project a concurrent create made", async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...home, name: "Work", id: "p9" });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }),
    );
    expect((await findOrCreateProjectByName("work")).id).toBe("p9");
  });
});

describe("nextProjectColor", () => {
  it("cycles by count once every colour is used", () => {
    const all = ["rose", "amber", "lime", "teal", "sky", "violet", "pink", "slate"];
    expect(nextProjectColor([])).toBe("rose");
    expect(nextProjectColor(all)).toBe("rose");
    expect(nextProjectColor([...all, "rose"])).toBe("amber");
  });
});
