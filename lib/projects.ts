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

export const updateProjectSchema = createProjectSchema.partial();

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/** Returns null when missing; throws Prisma P2002 on a duplicate name. */
export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDto | null> {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return null;
  return toDto(await prisma.project.update({ where: { id }, data: { name: input.name, color: input.color } }));
}

/** Tasks keep living with a null project through the SetNull relation. */
export async function deleteProject(id: string): Promise<boolean> {
  const { count } = await prisma.project.deleteMany({ where: { id } });
  return count > 0;
}
