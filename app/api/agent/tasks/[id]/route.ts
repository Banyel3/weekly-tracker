import { bodyWithId, restTool } from "@/lib/agent/rest";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return restTool(request, "get_task", { id });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return restTool(request, "update_task", bodyWithId(request, id));
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return restTool(request, "delete_task", { id });
}
