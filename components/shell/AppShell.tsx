"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useBoardContext } from "@/components/BoardProvider";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatWeekRange } from "@/lib/week";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { week } = useBoardContext();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh flex-col min-[900px]:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-50 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar min-[900px]:block min-[1100px]:w-60">
        <Sidebar showBars="wide" />
      </aside>
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center border-b border-sidebar-border bg-sidebar px-4 min-[900px]:hidden">
        {week && <h1 className="m-0 truncate text-[15px] leading-5 font-semibold">{formatWeekRange(week)}</h1>}
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          onOpenAutoFocus={(e) => {
            const target = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-current="page"], nav a');
            if (!target) return;
            e.preventDefault();
            target.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            moreButton.current?.focus();
          }}
          className="w-60 max-w-[85vw] gap-0 overflow-y-auto border-sidebar-border bg-sidebar p-0 motion-reduce:animate-none sm:max-w-60"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar showBars="always" titleAs="p" onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="min-w-0 flex-1 max-[899px]:pb-[calc(56px+env(safe-area-inset-bottom))]">{children}</main>
      <TabBar moreOpen={open} onMore={() => setOpen(true)} moreRef={moreButton} />
    </div>
  );
}
