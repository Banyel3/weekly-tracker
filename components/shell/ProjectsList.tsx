"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useBoardContext } from "@/components/BoardProvider";
import { ColorSwatches, colorVar } from "@/components/ColorSwatches";
import { useFilters } from "@/components/useFilters";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { ProjectFailure } from "@/components/useBoard";
import type { ProjectColor, ProjectDto } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { ProjectMenu, type ProjectAction } from "./ProjectMenu";

const DEFAULT_COLOR: ProjectColor = "teal";

type Notice = { message: string; again?: () => void } | null;

type Progress = { done: number; total: number };

type Props = { showBars: "always" | "wide" };

export function ProjectsList({ showBars }: Props) {
  const board = useBoardContext();
  const { filter, setFilter } = useFilters();
  const [notice, setNotice] = useState<Notice>(null);
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);

  const week = board.week?.start;
  const progress = new Map<string, Progress>();
  for (const t of board.tasks) {
    if (!t.projectId || t.weekOf !== week) continue;
    const p = progress.get(t.projectId) ?? { done: 0, total: 0 };
    p.total += 1;
    if (t.status === "DONE") p.done += 1;
    progress.set(t.projectId, p);
  }

  function closeForm() {
    setAdding(false);
    requestAnimationFrame(() => addRef.current?.focus());
  }

  function fail({ message, retryable }: ProjectFailure, again: () => void) {
    setNotice({ message, again: retryable ? again : undefined });
  }

  async function rename(project: ProjectDto, name: string) {
    const failure = await board.updateProject(project.id, { name });
    if (failure) fail(failure, () => rename(project, name));
  }

  async function recolor(project: ProjectDto, color: ProjectColor) {
    const failure = await board.updateProject(project.id, { color });
    if (failure) fail(failure, () => recolor(project, color));
  }

  function remove(project: ProjectDto) {
    if (filter?.kind === "project" && filter.id === project.id) setFilter(null);
    setNotice(null);
    board.removeProject(project.id, (failure) => fail(failure, () => remove(project)));
  }

  function toggle(id: string) {
    const selected = filter?.kind === "project" && filter.id === id;
    setFilter(selected ? null : { kind: "project", id });
  }

  return (
    <section aria-labelledby="projects-heading" className="flex flex-col gap-1.5">
      <h2 id="projects-heading" className="m-0 px-2 text-xs font-medium text-muted-foreground">
        Projects
      </h2>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {board.projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            progress={progress.get(project.id) ?? { done: 0, total: 0 }}
            selected={filter?.kind === "project" && filter.id === project.id}
            showBars={showBars}
            onToggle={() => toggle(project.id)}
            onRename={(name) => rename(project, name)}
            onRecolor={(color) => recolor(project, color)}
            onDelete={() => remove(project)}
          />
        ))}
      </ul>
      <div aria-live="polite" className="px-2 text-xs text-muted-foreground empty:hidden">
        {notice && (
          <p role="alert" className="m-0">
            {notice.message}
            {notice.again && (
              <>
                {" · "}
                <Button
                  variant="link"
                  size="inline"
                  className="text-foreground"
                  onClick={() => {
                    const again = notice.again;
                    setNotice(null);
                    again?.();
                  }}
                >
                  retry
                </Button>
              </>
            )}
          </p>
        )}
      </div>
      {adding ? (
        <NewProjectForm onDone={closeForm} />
      ) : (
        <Button
          ref={addRef}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAdding(true)}
          className="self-start text-muted-foreground pointer-coarse:h-11"
        >
          <Icon icon={Plus} size="sm" />
          Add project
        </Button>
      )}
    </section>
  );
}

type RowProps = {
  project: ProjectDto;
  progress: Progress;
  selected: boolean;
  showBars: "always" | "wide";
  onToggle: () => void;
  onRename: (name: string) => void;
  onRecolor: (color: ProjectColor) => void;
  onDelete: () => void;
};

function ProjectRow({ project, progress, selected, showBars, onToggle, onRename, onRecolor, onDelete }: RowProps) {
  const [renaming, setRenaming] = useState(false);
  const [recoloring, setRecoloring] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  function onAction(action: ProjectAction) {
    if (action === "rename") setRenaming(true);
    else if (action === "recolor") setRecoloring(true);
    else onDelete();
  }

  function finishRename(value: string | null) {
    setRenaming(false);
    const name = value?.trim();
    if (name && name !== project.name) onRename(name);
    requestAnimationFrame(() => menuRef.current?.focus());
  }

  return (
    <li>
      <Popover open={recoloring} onOpenChange={setRecoloring}>
        <PopoverAnchor asChild>
          <div
            className={cn(
              "group flex items-start gap-1 rounded-lg border p-1 transition-colors duration-150 ease-out motion-reduce:transition-none",
              selected ? "border-primary bg-muted" : "border-transparent hover:bg-sidebar-accent/50",
            )}
          >
            {renaming ? (
              <RenameInput name={project.name} onDone={finishRename} />
            ) : (
              <button
                type="button"
                aria-pressed={selected}
                onClick={onToggle}
                className="min-h-8 min-w-0 flex-1 rounded-md px-1 py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: colorVar(project.color) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <span aria-hidden="true">
                      {progress.done}/{progress.total}
                    </span>
                    <span className="sr-only">
                      {progress.done} of {progress.total} done this week
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 h-[3px] overflow-hidden rounded-sm bg-sidebar-border",
                    showBars === "always" ? "block" : "hidden min-[1100px]:block",
                  )}
                >
                  <span
                    className="block h-full origin-left transition-transform duration-150 ease-out motion-reduce:transition-none"
                    style={{ transform: `scaleX(${pct / 100})`, background: colorVar(project.color) }}
                  />
                </span>
              </button>
            )}
            <ProjectMenu
              ref={menuRef}
              name={project.name}
              onAction={onAction}
              className="opacity-60 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-auto p-3"
          onOpenAutoFocus={(e) => {
            const checked = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("input:checked");
            if (!checked) return;
            e.preventDefault();
            checked.focus();
          }}
          // A pointer pick closes the popover; arrow keys recolor in place and Escape closes.
          onClick={(e) => {
            if (e.detail > 0 && (e.target as HTMLElement).closest("label")) requestAnimationFrame(() => setRecoloring(false));
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            menuRef.current?.focus();
          }}
        >
          <ColorSwatches
            legend={`Color for ${project.name}`}
            value={project.color as ProjectColor}
            onChange={onRecolor}
          />
        </PopoverContent>
      </Popover>
    </li>
  );
}

function RenameInput({ name, onDone }: { name: string; onDone: (value: string | null) => void }) {
  const done = useRef(false);
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(value);
  };
  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        finish(new FormData(e.currentTarget).get("name") as string);
      }}
    >
      <Input
        name="name"
        aria-label={`Rename ${name}`}
        defaultValue={name}
        maxLength={40}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => finish(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            finish(null);
          }
        }}
        className="h-8 px-2 text-sm"
      />
    </form>
  );
}

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const board = useBoardContext();
  const [name, setName] = useState("");
  const [color, setColor] = useState<ProjectColor>(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await board.addProject({ name: name.trim(), color });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't create the project");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
      }}
      className="flex flex-col gap-2 rounded-lg border border-sidebar-border p-2"
    >
      <Input
        aria-label="Project name"
        placeholder="Project name"
        required
        maxLength={40}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 px-2 text-sm"
      />
      <ColorSwatches value={color} onChange={setColor} />
      {error && (
        <p role="alert" className="m-0 text-xs text-muted-foreground">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "adding…" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
