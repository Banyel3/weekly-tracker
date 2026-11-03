import { prisma } from "../db";
import { isPrismaError } from "../http";
import { createProject, PROJECT_COLORS, type ProjectDto } from "../projects";

const dto = (p: { id: string; name: string; color: string }): ProjectDto => ({ id: p.id, name: p.name, color: p.color });

/** Case-insensitive exact name match; null when there is none. */
export async function findProjectByName(name: string): Promise<ProjectDto | null> {
  const project = await prisma.project.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } } });
  return project && dto(project);
}

/** First palette colour no project uses yet; once all are taken, cycle by project count. */
export function nextProjectColor(used: string[], count: number = used.length): (typeof PROJECT_COLORS)[number] {
  const taken = new Set(used);
  return PROJECT_COLORS.find((c) => !taken.has(c)) ?? PROJECT_COLORS[count % PROJECT_COLORS.length];
}

/** The one place the agent API turns a project name into a project; a concurrent create of the same name wins and is reused. */
export async function findOrCreateProjectByName(name: string): Promise<ProjectDto> {
  const trimmed = name.trim();
  const existing = await findProjectByName(trimmed);
  if (existing) return existing;
  const projects = await prisma.project.findMany({ select: { color: true } });
  try {
    return await createProject({ name: trimmed, color: nextProjectColor(projects.map((p) => p.color)) });
  } catch (e) {
    if (!isPrismaError(e, "P2002")) throw e;
    const raced = await findProjectByName(trimmed);
    if (!raced) throw e;
    return raced;
  }
}
