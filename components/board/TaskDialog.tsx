"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChecklistItem } from "@/lib/checklist";
import type { ProjectColor, ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { ColorSwatches, colorVar } from "../ColorSwatches";
import type { NewTask } from "../useBoard";
import { Checklist } from "./Checklist";
import { COLUMNS, type Status } from "./dnd";
import { PriorityPills } from "./PriorityPills";

const DEFAULT_COLOR: ProjectColor = "teal";
const NO_PROJECT = "";
const NEW_PROJECT = "__new__";
const LABEL = "flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground";
const FIELD = "rounded-lg bg-background px-2.5 text-sm font-normal text-foreground";

export type DialogTarget =
  | { mode: "create"; initialStatus: Status }
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

function formOf(target: DialogTarget | null): Form {
  const task = target && target.mode !== "create" ? target.task : null;
  return {
    title: task?.title ?? "",
    project: task?.projectId ?? NO_PROJECT,
    newName: "",
    newColor: DEFAULT_COLOR,
    priority: task?.priority ?? "NONE",
    dueDate: task?.dueDate ?? "",
    note: task?.note ?? "",
    checklist: task?.checklist ?? [],
    status: task?.status ?? (target?.mode === "create" ? target.initialStatus : "BACKLOG"),
  };
}

export function TaskDialog({ target, projects, onCreateProject, onSubmit, onRestore, onDelete, onClose }: Props) {
  const [form, setForm] = useState<Form>(formOf(null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const deleted = useRef(false);

  const task = target && target.mode !== "create" ? target.task : null;
  const readOnly = target?.mode === "view";
  const creating = form.project === NEW_PROJECT;
  const selected = projects.find((p) => p.id === form.project) ?? null;
  const dotColor = creating ? form.newColor : selected?.color;

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

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
        onCloseAutoFocus={(e) => {
          if (!deleted.current) return;
          e.preventDefault();
          requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-undo-button]")?.focus());
        }}
        className="max-h-[calc(100dvh-2rem)] gap-3.5 overflow-y-auto rounded-lg bg-card p-5 sm:max-w-[440px]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <DialogTitle className="text-[15px] leading-5 font-medium">{heading}</DialogTitle>
          {readOnly && <DialogDescription className="text-xs">Restore it to edit.</DialogDescription>}
          <label className={LABEL}>
            Title
            <Textarea
              required
              autoFocus
              rows={2}
              maxLength={200}
              disabled={disabled}
              value={form.title}
              onChange={(e) => set("title", e.target.value.replace(/[\r\n]+/g, " "))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              className={`${FIELD} min-h-0 resize-y py-2 [field-sizing:fixed]`}
            />
          </label>
          <label className={LABEL}>
            Project
            <span className="flex items-center gap-2">
              {dotColor && (
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: colorVar(dotColor) }} />
              )}
              <select
                value={form.project}
                disabled={disabled}
                onChange={(e) => set("project", e.target.value)}
                className={`${FIELD} h-9 min-w-0 flex-1 border border-input outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 pointer-coarse:h-11`}
              >
                <option value={NO_PROJECT}>No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {onCreateProject && <option value={NEW_PROJECT}>New project…</option>}
              </select>
            </span>
          </label>
          {creating && (
            <div className="-mt-1 flex flex-col gap-2 border-l pl-3">
              <label className={LABEL}>
                Project name
                <Input
                  required
                  maxLength={40}
                  value={form.newName}
                  onChange={(e) => set("newName", e.target.value)}
                  className={`${FIELD} pointer-coarse:h-11`}
                />
              </label>
              <ColorSwatches value={form.newColor} onChange={(color) => set("newColor", color)} />
            </div>
          )}
          <PriorityPills value={form.priority} onChange={(v) => set("priority", v)} disabled={disabled} />
          <label className={LABEL}>
            Due date
            <Input
              type="date"
              value={form.dueDate}
              disabled={disabled}
              onChange={(e) => set("dueDate", e.target.value)}
              className={`${FIELD} [color-scheme:dark] pointer-coarse:h-11`}
            />
          </label>
          <label className={LABEL}>
            Note
            <Textarea
              rows={3}
              maxLength={2000}
              disabled={disabled}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              className={`${FIELD} min-h-0 resize-y py-2 [field-sizing:fixed]`}
            />
          </label>
          <Checklist items={form.checklist} onChange={(items) => set("checklist", items)} disabled={disabled} />
          <div className={LABEL}>
            <label htmlFor="task-status">Status</label>
            <Select value={form.status} onValueChange={(v) => set("status", v as Status)} disabled={disabled}>
              <SelectTrigger id="task-status" className={`${FIELD} w-full pointer-coarse:h-11`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map(({ status, label }) => (
                  <SelectItem key={status} value={status}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {task && (
              <Button type="button" variant="ghost" onClick={remove} disabled={busy !== null} className="text-muted-foreground pointer-coarse:h-11">
                Delete
              </Button>
            )}
            <span className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose} disabled={busy !== null} className="pointer-coarse:h-11">
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {readOnly ? (
              <Button type="button" variant="secondary" onClick={restore} disabled={busy !== null} className="pointer-coarse:h-11">
                {busy === "restoring" ? "restoring…" : "restore to Backlog"}
              </Button>
            ) : (
              <Button type="submit" variant="secondary" disabled={busy !== null} className="font-medium pointer-coarse:h-11">
                {busy === "saving" ? "saving…" : task ? "Save" : "Add"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
