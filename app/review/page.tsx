"use client";

import { useJson } from "@/components/useJson";
import type { ReviewDto } from "@/lib/review";

const SECTIONS = ["week", "thisWeek", "carried", "lastWeek", "perDay"] as const;

export default function ReviewPage() {
  const state = useJson<ReviewDto>("/api/review");

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="m-0 text-[15px] font-medium">Weekly review</h2>
      {state.status === "loading" && <p className="m-0 text-muted-foreground">loading…</p>}
      {state.status === "error" && <p className="m-0 text-muted-foreground">couldn&apos;t load the review</p>}
      {state.status === "ready" &&
        SECTIONS.map((key) => (
          <section key={key} className="flex flex-col gap-1">
            <h3 className="m-0 text-xs font-semibold text-muted-foreground">{key}</h3>
            <pre className="m-0 overflow-x-auto rounded-md bg-card p-3 text-xs">
              {JSON.stringify(state.data[key], null, 2)}
            </pre>
          </section>
        ))}
    </div>
  );
}
