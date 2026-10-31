import { parseBody } from "@/lib/http";
import { deleteTask, updateTask, updateTaskSchema } from "@/lib/tasks";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = await parseBody(request, updateTaskSchema);
  if (!parsed.ok) return parsed.response;
  const task = await updateTask(id, parsed.data);
  return task ? Response.json(task) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return (await deleteTask(id)) ? new Response(null, { status: 204 }) : notFound();
}
