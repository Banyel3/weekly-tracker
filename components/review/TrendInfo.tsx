"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Icon } from "@/components/ui/icon";

export function TrendInfo() {
  return (
    <Hint label="Planned counts every task put on a week and not taken off it; finished leaves out ones reopened that week; deleted tasks count only as dropped.">
      <Button
        variant="ghost"
        size="icon"
        aria-label="How planned and finished are counted"
        className="size-6 text-muted-foreground hover:text-foreground pointer-coarse:size-11"
      >
        <Icon icon={Info} size="sm" />
      </Button>
    </Hint>
  );
}
