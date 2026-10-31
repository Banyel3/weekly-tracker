import { isPrismaError, parseBody } from "@/lib/http";
import { createProject, createProjectSchema, listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listProjects());
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createProjectSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return Response.json(await createProject(parsed.data), { status: 201 });
  } catch (e) {
    if (isPrismaError(e, "P2002")) {
      return Response.json({ error: "A project with that name already exists" }, { status: 409 });
    }
    throw e;
  }
}
