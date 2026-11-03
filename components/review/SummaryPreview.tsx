import type { ReviewDto } from "@/lib/review";
import { buildWeeklySummaryText } from "@/lib/summaryText";
import { MUTED, TITLE } from "./styles";

export function SummaryPreview({ review }: { review: ReviewDto }) {
  return (
    <section
      aria-labelledby="review-summary"
      className="flex flex-col gap-2 rounded-xl border border-dashed p-4 text-card-foreground"
    >
      <h3 id="review-summary" className={TITLE}>
        Friday 18:00 Telegram summary (preview)
      </h3>
      <pre className="m-0 font-sans text-[13px] whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
        {buildWeeklySummaryText(review)}
      </pre>
      <p className={MUTED}>sent only when Telegram is configured</p>
    </section>
  );
}
