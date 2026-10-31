"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectColor, ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { COLUMNS, type Status } from "./dnd";
import type { NewTask } from "./useBoard";

/** Mirrors PROJECT_COLORS in lib/projects (not value-imported: that module pulls in Prisma). */
const COLORS: readonly ProjectColor[] = ["rose", "amber", "lime", "teal", "sky", "violet", "pink", "slate"];
const DEFAULT_COLOR: ProjectColor = "teal";
const NO_PROJECT = "";
const NEW_PROJECT = "__new__";

export type DialogTarget = { mode: "create"; initialStatus: Status } | { mode: "edit"; task: TaskDto };

type Props = {
  target: DialogTarget | null;
  projects: ProjectDto[];
  onCreateProject: (name: string, color: ProjectColor) => Promise<ProjectDto>;
  onSubmit: (body: NewTask) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onClose: () => void;
};

type Form = {
  title: string;
  project: string;
  newName: string;
  newColor: ProjectColor;
  dueDate: string;
  note: string;
  status: Status;
};
type Busy = "saving" | "deleting" | null;

const CONFIRM_MS = 3000;

function formOf(target: DialogTarget | null): Form {
  const task = target?.mode === "edit" ? target.task : null;
  return {
    title: task?.title ?? "",
    project: task?.projectId ?? NO_PROJECT,
    newName: "",
    newColor: DEFAULT_COLOR,
    dueDate: task?.dueDate ?? "",
    note: task?.note ?? "",
    status: task?.status ?? (target?.mode === "create" ? target.initialStatus : "BACKLOG"),
  };
}

function colorVar(color: string): string {
  return `var(--project-${color})`;
}

export function TaskDialog({ target, projects, onCreateProject, onSubmit, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<Form>(formOf(null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirming, setConfirming] = useState(false);

  const task = target?.mode === "edit" ? target.task : null;
  const creating = form.project === NEW_PROJECT;
  const selected = projects.find((p) => p.id === form.project) ?? null;
  const dotColor = creating ? form.newColor : selected?.color;

  function stopConfirm() {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirming(false);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    stopConfirm();
    if (target) {
      setForm(formOf(target));
      setError(null);
      setBusy(null);
      if (!dialog.open) dialog.showModal();
      titleRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [target]);

  useEffect(() => stopConfirm, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function resolveProject(): Promise<string | null | undefined> {
    if (!creating) return form.project || null;
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
    setBusy("saving");
    setError(null);
    const projectId = await resolveProject();
    if (projectId === undefined) {
      setBusy(null);
      return;
    }
    const failure = await onSubmit({
      title: form.title,
      projectId,
      dueDate: form.dueDate || null,
      note: form.note || null,
      status: form.status,
    });
    setBusy(null);
    if (failure) setError(failure);
    else onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target || busy) return;
    save();
  }

  async function onDeleteClick() {
    if (!task || busy) return;
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(stopConfirm, CONFIRM_MS);
      return;
    }
    stopConfirm();
    setBusy("deleting");
    setError(null);
    const failure = await onDelete(task.id);
    setBusy(null);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <dialog ref={ref} className="task-dialog" aria-labelledby="task-dialog-title" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 id="task-dialog-title">{task ? "Edit task" : "New task"}</h2>
        <label>
          Title
          <textarea
            ref={titleRef}
            required
            autoFocus
            rows={2}
            maxLength={200}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </label>
        <label>
          Project
          <span className="project-row">
            {dotColor && <span className="chip-dot" aria-hidden="true" style={{ background: colorVar(dotColor) }} />}
            <select value={form.project} onChange={(e) => set("project", e.target.value)}>
              <option value={NO_PROJECT}>No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value={NEW_PROJECT}>New project…</option>
            </select>
          </span>
        </label>
        {creating && (
          <div className="new-project">
            <label>
              Project name
              <input
                required
                maxLength={40}
                value={form.newName}
                onChange={(e) => set("newName", e.target.value)}
              />
            </label>
            <fieldset className="swatches">
              <legend>Color</legend>
              {COLORS.map((color) => (
                <label key={color} className="swatch">
                  <input
                    type="radio"
                    name="project-color"
                    className="visually-hidden"
                    aria-label={color}
                    value={color}
                    checked={form.newColor === color}
                    onChange={() => set("newColor", color)}
                  />
                  <span className="swatch-dot" style={{ background: colorVar(color) }} />
                </label>
              ))}
            </fieldset>
          </div>
        )}
        <label>
          Due date
          <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </label>
        <label>
          Note
          <textarea rows={4} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </label>
        <label>
          Status
          <select value={form.status} onChange={(e) => set("status", e.target.value as Status)}>
            {COLUMNS.map(({ status, label }) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {task && (
            <button type="button" onClick={onDeleteClick} disabled={busy !== null}>
              {busy === "deleting" ? "deleting…" : confirming ? "Delete? yes" : "Delete"}
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy !== null}>
            {busy === "saving" ? "saving…" : task ? "Save" : "Add"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
