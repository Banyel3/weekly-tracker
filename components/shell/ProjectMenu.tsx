"use client";

import { forwardRef, useRef } from "react";
import { MoreHorizontal, Palette, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ProjectAction = "rename" | "recolor" | "delete";

type Props = { name: string; onAction: (action: ProjectAction) => void; className?: string };

export const ProjectMenu = forwardRef<HTMLButtonElement, Props>(function ProjectMenu({ name, onAction, className }, ref) {
  // Run the action once the menu has closed and released focus, so a rename input or popover can take it.
  const pending = useRef<ProjectAction | null>(null);
  const choose = (action: ProjectAction) => () => {
    pending.current = action;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={ref}
        aria-label={`${name} options`}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent motion-reduce:transition-none pointer-coarse:size-11",
          className,
        )}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-36"
        onCloseAutoFocus={(e) => {
          const action = pending.current;
          pending.current = null;
          if (!action) return;
          e.preventDefault();
          onAction(action);
        }}
      >
        <DropdownMenuItem onSelect={choose("rename")}>
          <Pencil aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={choose("recolor")}>
          <Palette aria-hidden="true" />
          Recolor
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={choose("delete")}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
