import type { InsightsDto } from "@/lib/insights";
import { InsightCard, InsightStat } from "./InsightStat";
import { daysText } from "./review";

export function FlowCard({ flow }: { flow: InsightsDto["flow"] }) {
  return (
    <InsightCard id="review-flow" title="Flow" note="finished this week">
      <InsightStat value={daysText(flow.medianCreatedToDoneDays)} meaning="median from added to done" />
      <InsightStat value={daysText(flow.medianInProgressDays)} meaning="median time in progress before done" />
      <InsightStat value={flow.reopened} meaning="reopened after being marked done" />
    </InsightCard>
  );
}
