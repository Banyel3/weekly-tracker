import { restTool } from "@/lib/agent/rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return restTool(request, "get_review");
}
