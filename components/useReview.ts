"use client";

import type { ReviewDto } from "@/lib/review";
import { useBoardContext } from "./BoardProvider";
import { reviewUrl } from "./reviewUrl";
import { useJson, type JsonState } from "./useJson";

export function useReview(): JsonState<ReviewDto> {
  const { status, version } = useBoardContext();
  return useJson<ReviewDto>(reviewUrl(status), version);
}
