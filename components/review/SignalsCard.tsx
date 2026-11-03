import type { InsightsDto } from "@/lib/insights";
import { InsightCard, InsightStat } from "./InsightStat";
import { daysText, shareText } from "./review";

export function SignalsCard({ signals }: { signals: InsightsDto["signals"] }) {
  const perPlanned = signals.reschedulesPerPlanned === null ? "" : ` · ${signals.reschedulesPerPlanned} per planned task`;
  return (
    <InsightCard id="review-signals" title="Signals" note="observations, not grades">
      <InsightStat value={signals.reschedules} meaning={`due dates moved this week${perPlanned}`} />
      <InsightStat value={daysText(signals.avgOverdueDaysBeforeDone)} meaning="average days past due when finished" />
      <InsightStat value={signals.rolledTwice} meaning="tasks carried over twice or more" />
      <InsightStat value={daysText(signals.oldestBacklogAgeDays)} meaning="age of the oldest Backlog task" />
      <InsightStat value={shareText(signals.midWeekRatio)} meaning="of this week's tasks planned after Monday" />
    </InsightCard>
  );
}
