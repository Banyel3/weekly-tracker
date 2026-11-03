import { colorVar } from "../ColorSwatches";

export function ProjectDot({ color }: { color: string }) {
  return <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: colorVar(color) }} />;
}
