"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useBoardContext } from "@/components/BoardProvider";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatWeekRange } from "@/lib/week";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { week } = useBoardContext();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh flex-col min-[900px]:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-50 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar min-[900px]:block min-[1100px]:w-60">
        <Sidebar showBars="wide" />
      </aside>
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-2 min-[900px]:hidden">
        <button
          ref={menuButton}
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-md text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        {week && <h1 className="m-0 truncate text-[15px] font-medium">{formatWeekRange(week)}</h1>}
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
            menuButton.current?.focus();
          }}
          className="w-60 max-w-[85vw] gap-0 overflow-y-auto border-sidebar-border bg-sidebar p-0 motion-reduce:animate-none sm:max-w-60"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar showBars="always" onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
