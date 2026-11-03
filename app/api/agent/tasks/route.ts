import { listInput, objectBody, restTool } from "@/lib/agent/rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return restTool(request, "list_tasks", listInput(new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  return restTool(request, "create_task", async () => {
    const body = await objectBody(request);
    return body.ok ? body.data : body.response;
  });
}
