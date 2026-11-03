"use client";

import { createContext, useContext } from "react";
import type { ReviewDto } from "@/lib/review";
import { reviewUrl } from "./reviewUrl";
import type { LoadStatus } from "./useBoard";
import { useJson, type JsonState } from "./useJson";

export const ReviewContext = createContext<JsonState<ReviewDto> | null>(null);

/** One instance, held by BoardProvider, so pages share the review across navigation. */
export function useReviewState(status: LoadStatus, version: number): JsonState<ReviewDto> {
  return useJson<ReviewDto>(reviewUrl(status), version);
}

export function useReviewContext(): JsonState<ReviewDto> {
  const value = useContext(ReviewContext);
  if (!value) throw new Error("useReviewContext must be used inside <BoardProvider>");
  return value;
}
