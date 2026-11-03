import type { ReactNode } from "react";
import { CARD, MUTED, TITLE } from "./styles";

type Props = { value: string | number; meaning: string };

export function InsightStat({ value, meaning }: Props) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="order-2 text-xs leading-4 text-muted-foreground">{meaning}</dt>
      <dd className="order-1 m-0 text-[17px] leading-6 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

type CardProps = { id: string; title: string; note: string; children: ReactNode };

export function InsightCard({ id, title, note, children }: CardProps) {
  return (
    <section aria-labelledby={id} className={CARD}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className={TITLE}>
          {title}
        </h3>
        <span className={MUTED}>{note}</span>
      </div>
      <dl className="m-0 grid grid-cols-1 gap-3">{children}</dl>
    </section>
  );
}
