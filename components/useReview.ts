"use client";

import type { ReviewDto } from "@/lib/review";
import { useBoardContext } from "./BoardProvider";
import { useJson, type JsonState } from "./useJson";

export function useReview(): JsonState<ReviewDto> {
  const { version } = useBoardContext();
  return useJson<ReviewDto>("/api/review", version);
}
