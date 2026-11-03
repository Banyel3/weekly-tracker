import type { LoadStatus } from "./useBoard";

/** Waits for the board's first load, whose version bump would otherwise trigger a second request on mount. */
export function reviewUrl(status: LoadStatus): string | null {
  return status === "ready" ? "/api/review" : null;
}
