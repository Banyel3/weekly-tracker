"use client";

import { forwardRef, useRef } from "react";
import { MoreHorizontal, Palette, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Icon } from "@/components/ui/icon";
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
      <Hint label="Project options">
        <DropdownMenuTrigger asChild>
          <Button
            ref={ref}
            variant="ghost"
            size="icon"
            aria-label={`${name} options`}
            className={cn(
              "size-7 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent pointer-coarse:size-11",
              className,
            )}
          >
            <Icon icon={MoreHorizontal} />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
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
          <Icon icon={Pencil} />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={choose("recolor")}>
          <Icon icon={Palette} />
          Recolor
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={choose("delete")}>
          <Icon icon={Trash2} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
