import type { ReviewDto } from "@/lib/review";
import { buildWeeklySummaryText } from "@/lib/summaryText";
import { CARD, MUTED, TITLE } from "./styles";

export function SummaryPreview({ review }: { review: ReviewDto }) {
  return (
    <section aria-labelledby="review-summary" className={CARD}>
      <h3 id="review-summary" className={TITLE}>
        Friday 18:00 Telegram summary (preview)
      </h3>
      <pre className="m-0 rounded-lg border bg-muted px-2.5 py-2 font-sans text-xs leading-5 whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
        {buildWeeklySummaryText(review)}
      </pre>
      <p className={MUTED}>sent only when Telegram is configured</p>
    </section>
  );
}
