import { isPrismaError, parseBody } from "@/lib/http";
import { deleteProject, updateProject, updateProjectSchema } from "@/lib/projects";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = await parseBody(request, updateProjectSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const project = await updateProject(id, parsed.data);
    return project ? Response.json(project) : notFound();
  } catch (e) {
    if (isPrismaError(e, "P2002")) {
      return Response.json({ error: "A project with that name already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return (await deleteProject(id)) ? new Response(null, { status: 204 }) : notFound();
}
