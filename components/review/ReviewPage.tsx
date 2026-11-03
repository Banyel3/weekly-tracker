"use client";

import { useBoardContext } from "../BoardProvider";
import { UndoLine } from "../board/UndoLine";
import { useReviewContext } from "../useReview";
import { CarriedSection } from "./CarriedSection";
import { FlowCard } from "./FlowCard";
import { LastWeekSection } from "./LastWeekSection";
import { SignalsCard } from "./SignalsCard";
import { LINK_BUTTON } from "./styles";
import { SummaryPreview } from "./SummaryPreview";
import { ThisWeekSection } from "./ThisWeekSection";
import { TrendCard } from "./TrendCard";

function Retry({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <p role="alert" className="m-0 text-sm text-muted-foreground">
      {text} ·{" "}
      <button type="button" onClick={onRetry} className={LINK_BUTTON}>
        retry
      </button>
    </p>
  );
}

export function ReviewPage() {
  const board = useBoardContext();
  const review = useReviewContext();
  const failed = review.status === "error" || (review.status === "loading" && board.status === "error");

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[15px] leading-5 font-medium">Weekly review</h2>
        <UndoLine className="min-h-4" />
        {board.error === "save" && <Retry text="couldn't save" onRetry={board.retry} />}
      </div>
      {failed && <Retry text="couldn't load the review" onRetry={() => void board.reload()} />}
      {!failed && review.status === "loading" && (
        <div aria-busy="true" aria-label="Loading the review" className="flex flex-col gap-6">
          {[120, 160, 96].map((h) => (
            <div
              key={h}
              style={{ height: h }}
              className="animate-pulse rounded-xl border bg-card motion-reduce:animate-none"
            />
          ))}
        </div>
      )}
      {review.status === "ready" && (
        <>
          <ThisWeekSection
            thisWeek={review.data.thisWeek}
            today={review.data.today}
            insights={review.data.insights}
          />
          <div className="grid grid-cols-2 gap-6 max-[699px]:grid-cols-1">
            <FlowCard flow={review.data.insights.flow} />
            <SignalsCard signals={review.data.insights.signals} />
          </div>
          <TrendCard trend={review.data.insights.trend} current={review.data.week.start} />
          <CarriedSection carried={review.data.carried} />
          <LastWeekSection lastWeek={review.data.lastWeek} />
          <SummaryPreview review={review.data} />
        </>
      )}
    </div>
  );
}
