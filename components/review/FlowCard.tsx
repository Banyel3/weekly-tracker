import type { InsightsDto } from "@/lib/insights";
import { InsightCard, InsightStat } from "./InsightStat";
import { daysText } from "./review";

type Props = { flow: InsightsDto["flow"]; overdueDays: InsightsDto["signals"]["avgOverdueDaysBeforeDone"] };

export function FlowCard({ flow, overdueDays }: Props) {
  return (
    <InsightCard id="review-flow" title="Flow" note="finished this week">
      <InsightStat value={daysText(flow.medianCreatedToDoneDays)} meaning="median from added to done" />
      <InsightStat value={daysText(flow.medianInProgressDays)} meaning="median time in progress before done" />
      <InsightStat value={flow.reopened} meaning="reopened after being marked done" />
      <InsightStat value={daysText(overdueDays)} meaning="average days past due when finished" />
    </InsightCard>
  );
}
