import { Board } from "@/components/board/Board";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { StatsRow } from "@/components/stats/StatsRow";

export default function Home() {
  return (
    <div className="flex h-dvh flex-col gap-4 overflow-y-auto p-6 max-[899px]:h-[calc(100dvh-3rem)] max-[599px]:h-auto max-[599px]:p-4">
      <StatsRow />
      <WeekCalendar />
      <Board />
    </div>
  );
}
