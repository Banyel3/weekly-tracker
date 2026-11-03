import { Board } from "@/components/board/Board";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { StatsRow } from "@/components/stats/StatsRow";

export default function Home() {
  return (
    // Phones read board first, then the week, then the numbers; the DOM (and desktop) order stays stats, calendar, board.
    <div className="flex h-dvh flex-col gap-4 overflow-y-auto p-6 max-[899px]:h-auto max-[899px]:overflow-visible max-[899px]:[&>:first-child]:order-last max-[899px]:[&>:last-child]:order-first max-[599px]:p-4">
      <StatsRow />
      <WeekCalendar />
      <Board />
    </div>
  );
}
