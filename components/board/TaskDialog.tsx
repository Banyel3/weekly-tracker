"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog, ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChecklistItem } from "@/lib/checklist";
import type { ProjectColor, ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { ColorSwatches, colorVar } from "../ColorSwatches";
import type { NewTask } from "../useBoard";
import { useIsPhone } from "../useMediaQuery";
import { Checklist } from "./Checklist";
import { STATUS_OPTIONS, statusLabel, statusVar, type Status } from "./status";
import { PriorityPills } from "./PriorityPills";

const DEFAULT_COLOR: ProjectColor = "teal";
const NO_PROJECT = "";
const NO_PROJECT_ITEM = "__none__";
const NEW_PROJECT = "__new__";
const FIELD = "flex flex-col gap-1.5";
const LABEL = "text-xs font-medium text-muted-foreground";
const CONTROL = "h-9 w-full rounded-md border-input bg-background text-sm text-foreground shadow-none pointer-coarse:h-11";
const AREA = "min-h-0 rounded-md border-input bg-background py-2 text-sm text-foreground shadow-none resize-none";

function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export type DialogTarget =
  | { mode: "create"; initialStatus: Status; dueDate?: string }
  | { mode: "edit"; task: TaskDto }
  | { mode: "view"; task: TaskDto };

type Props = {
  target: DialogTarget | null;
  projects: ProjectDto[];
  onCreateProject?: (name: string, color: ProjectColor) => Promise<ProjectDto>;
  onSubmit?: (body: NewTask) => Promise<string | null>;
  onRestore?: (task: TaskDto) => Promise<string | null>;
  onDelete: (task: TaskDto) => void;
  onClose: () => void;
};

type Form = {
  title: string;
  project: string;
  newName: string;
  newColor: ProjectColor;
  priority: TaskDto["priority"];
  dueDate: string;
  note: string;
  checklist: ChecklistItem[];
  status: Status;
};
type Busy = "saving" | "restoring" | null;

export function formOf(target: DialogTarget | null): Form {
  const task = target && target.mode !== "create" ? target.task : null;
  return {
    title: task?.title ?? "",
    project: task?.projectId ?? NO_PROJECT,
    newName: "",
    newColor: DEFAULT_COLOR,
    priority: task?.priority ?? "NONE",
    dueDate: task?.dueDate ?? (target?.mode === "create" ? (target.dueDate ?? "") : ""),
    note: task?.note ?? "",
    checklist: task?.checklist ?? [],
    status: task?.status ?? (target?.mode === "create" ? target.initialStatus : "BACKLOG"),
  };
}

/** The opener if it is still live, else the card that now shows the task (a save can move it to another column), else the Future Add button. */
function returnFocus(el: HTMLElement | null, taskId: string | null) {
  const live = (node: HTMLElement | null) => node?.isConnected && !node.closest("[data-motion-pop-id]");
  if (el && live(el)) return el.focus({ preventScroll: true });
  if (!taskId) return;
  const titles = document.querySelectorAll<HTMLElement>(`[data-card-title="${CSS.escape(taskId)}"]`);
  const card = [...titles].find(live);
  if (card) return card.focus({ preventScroll: true });
  // The task left the list (a save on /future promoted it), so land on the Future page's Add button.
  document.getElementById("future-add")?.focus({ preventScroll: true });
}

export function TaskDialog({ target, projects, onCreateProject, onSubmit, onRestore, onDelete, onClose }: Props) {
  const [form, setForm] = useState<Form>(formOf(null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const deleted = useRef(false);
  const opener = useRef<{ el: HTMLElement | null; taskId: string | null }>({ el: null, taskId: null });
  const phone = useIsPhone();

  const task = target && target.mode !== "create" ? target.task : null;
  const readOnly = target?.mode === "view";
  const creating = form.project === NEW_PROJECT;
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;

  const isOpen = target !== null;
  // Layout phase: runs before the dialog's focus scope moves focus inside, so activeElement is still the opener.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = document.activeElement;
    opener.current = { el: el instanceof HTMLElement ? el : null, taskId: task?.id ?? null };
  }, [isOpen]);

  useEffect(() => {
    if (!target) return;
    setForm(formOf(target));
    setError(null);
    setBusy(null);
    deleted.current = false;
  }, [target]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function resolveProject(): Promise<string | null | undefined> {
    if (!creating) return form.project || null;
    if (!onCreateProject) return undefined;
    try {
      const project = await onCreateProject(form.newName.trim(), form.newColor);
      // Point the form at the created project so a retry after a task failure does not recreate it.
      setForm((f) => ({ ...f, project: project.id, newName: "" }));
      return project.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't create the project");
      return undefined;
    }
  }

  async function save() {
    if (!onSubmit) return;
    setBusy("saving");
    setError(null);
    const projectId = await resolveProject();
    if (projectId === undefined) {
      setBusy(null);
      return;
    }
    const failure = await onSubmit({
      title: form.title.trim(),
      projectId,
      priority: form.priority,
      dueDate: form.dueDate || null,
      note: form.note || null,
      checklist: form.checklist.map((i) => ({ ...i, text: i.text.trim() })).filter((i) => i.text),
      status: form.status,
    });
    setBusy(null);
    if (failure) setError(failure);
    else onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target || busy || readOnly) return;
    save();
  }

  function remove() {
    if (!task || busy) return;
    deleted.current = true;
    onDelete(task);
    onClose();
  }

  async function restore() {
    if (!task || !onRestore || busy) return;
    setBusy("restoring");
    setError(null);
    const failure = await onRestore(task);
    setBusy(null);
    if (failure) setError(failure);
    else onClose();
  }

  const disabled = readOnly || busy !== null;
  const heading = readOnly ? "Archived task" : task ? "Edit task" : "New task";
  const project = task ? projects.find((p) => p.id === task.projectId) : null;
  const description = readOnly
    ? "Restore it to edit."
    : task
      ? (project?.name ?? "No project")
      : (
        <>
          Add a task to{" "}
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Dot color={statusVar(form.status)} />
            {statusLabel(form.status)}
          </span>
        </>
      );

  return (
    <ResponsiveDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <ResponsiveDialogContent
        onDismiss={() => !busy && onClose()}
        onOpenAutoFocus={(e) => {
          // On phones the sheet takes focus itself so the keyboard does not pop up over it.
          if (!phone) return;
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
        onCloseAutoFocus={(e) => {
          // Radix hands focus back to a DialogTrigger; this dialog has none, so it returns focus itself.
          e.preventDefault();
          const wasDeleted = deleted.current;
          const { el, taskId } = opener.current;
          requestAnimationFrame(() => {
            if (wasDeleted) document.querySelector<HTMLElement>("[data-undo-button]")?.focus();
            else returnFocus(el, taskId);
          });
        }}
        className="gap-5 bg-card p-6"
        dialogClassName="flex max-h-[85dvh] flex-col rounded-xl sm:max-w-[480px]"
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-5">
          <DialogHeader className="gap-1 pr-8 text-left">
            <DialogTitle className="text-[15px] leading-5 font-semibold">{heading}</DialogTitle>
            <DialogDescription className="truncate text-xs">{description}</DialogDescription>
          </DialogHeader>
          <div className={cn("flex flex-col gap-4", !phone && "-mx-1 min-h-0 overflow-y-auto px-1 py-1")}>
            <div className={FIELD}>
              <Label htmlFor={id("title")} className={LABEL}>
                Title
              </Label>
              <Textarea
                id={id("title")}
                required
                autoFocus={!phone}
                rows={1}
                maxLength={200}
                placeholder="What needs doing?"
                disabled={disabled}
                value={form.title}
                onChange={(e) => set("title", e.target.value.replace(/[\r\n]+/g, " "))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                className={cn(AREA, "max-h-[78px] min-h-9")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(FIELD, "min-w-0")}>
                <Label htmlFor={id("project")} className={LABEL}>
                  Project
                </Label>
                <Select
                  value={form.project || NO_PROJECT_ITEM}
                  onValueChange={(v) => set("project", v === NO_PROJECT_ITEM ? NO_PROJECT : v)}
                  disabled={disabled}
                >
                  <SelectTrigger id={id("project")} className={CONTROL}>
                    <SelectValue className="min-w-0" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT_ITEM}>No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <Dot color={colorVar(p.color)} />
                        <span className="min-w-0 truncate">{p.name}</span>
                      </SelectItem>
                    ))}
                    {onCreateProject && (
                      <SelectItem value={NEW_PROJECT}>
                        <Dot color={colorVar(form.newColor)} />
                        New project…
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className={cn(FIELD, "min-w-0")}>
                <Label htmlFor={id("due")} className={LABEL}>
                  Due date
                </Label>
                <div className="relative">
                  <Icon
                    icon={CalendarDays}
                    className="pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id={id("due")}
                    type="date"
                    value={form.dueDate}
                    disabled={disabled}
                    onChange={(e) => set("dueDate", e.target.value)}
                    className={cn(CONTROL, "relative cursor-pointer pl-8 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-auto [&::-webkit-calendar-picker-indicator]:w-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0")}
                  />
                </div>
              </div>
            </div>
            {creating && (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted px-2.5 py-2">
                <div className={FIELD}>
                  <Label htmlFor={id("new-project")} className={LABEL}>
                    Project name
                  </Label>
                  <Input
                    id={id("new-project")}
                    required
                    maxLength={40}
                    value={form.newName}
                    onChange={(e) => set("newName", e.target.value)}
                    className={CONTROL}
                  />
                </div>
                <ColorSwatches value={form.newColor} onChange={(color) => set("newColor", color)} />
              </div>
            )}
            <PriorityPills value={form.priority} onChange={(v) => set("priority", v)} disabled={disabled} />
            <div className={FIELD}>
              <Label htmlFor={id("note")} className={LABEL}>
                Note
              </Label>
              <Textarea
                id={id("note")}
                rows={2}
                maxLength={2000}
                placeholder="Optional note"
                disabled={disabled}
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                className={cn(AREA, "field-sizing-fixed")}
              />
            </div>
            <Checklist items={form.checklist} onChange={(items) => set("checklist", items)} disabled={disabled} />
            {task && (
              <div className={FIELD}>
                <Label htmlFor={id("status")} className={LABEL}>
                  Status
                </Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as Status)} disabled={disabled}>
                  <SelectTrigger id={id("status")} className={CONTROL}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(({ status, label }) => (
                      <SelectItem key={status} value={status}>
                        <Dot color={statusVar(status)} />
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {task && task.rolloverCount >= 2 && (
              <p className="m-0 text-xs text-muted-foreground">
                Rolled over {task.rolloverCount} weeks in a row. Split it, shrink it, or let it go.
              </p>
            )}
            {error && (
              <p role="alert" className="m-0 text-sm text-muted-foreground">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="flex-row items-center gap-2">
            {task && (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                disabled={busy !== null}
                className="-ml-3 text-destructive hover:text-destructive pointer-coarse:h-11"
              >
                Delete
              </Button>
            )}
            <span className="flex-1" />
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy !== null} className="pointer-coarse:h-11">
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {readOnly ? (
              <Button type="button" onClick={restore} disabled={busy !== null} className="pointer-coarse:h-11">
                {busy === "restoring" ? "Restoring…" : "Restore to Backlog"}
              </Button>
            ) : (
              <Button type="submit" disabled={busy !== null} className="pointer-coarse:h-11">
                {busy === "saving" ? "Saving…" : task ? "Save" : "Add"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
