import type { Project } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";

export const PROJECT_COLORS = ["rose", "amber", "lime", "teal", "sky", "violet", "pink", "slate"] as const;

export const projectColorSchema = z.enum(PROJECT_COLORS);

export type ProjectColor = z.infer<typeof projectColorSchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: projectColorSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export type ProjectDto = { id: string; name: string; color: string };

function toDto(project: Project): ProjectDto {
  return { id: project.id, name: project.name, color: project.color };
}

export async function listProjects(): Promise<ProjectDto[]> {
  const projects = await prisma.project.findMany({ orderBy: { name: "asc" } });
  return projects.map(toDto);
}

/** Throws Prisma P2002 on a duplicate name; the route maps it to 409. */
export async function createProject(input: CreateProjectInput): Promise<ProjectDto> {
  return toDto(await prisma.project.create({ data: { name: input.name, color: input.color } }));
}
