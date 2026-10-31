import { getReview } from "@/lib/review";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getReview());
}
