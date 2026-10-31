"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TaskDto } from "@/lib/tasks";
import { COLUMNS, type Status } from "./dnd";
import type { TaskPatch } from "./useBoard";

type Props = {
  task: TaskDto | null;
  onClose: () => void;
  onSave: (id: string, patch: TaskPatch) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
};

type Form = { title: string; dueDate: string; note: string; status: Status };
type Busy = "saving" | "deleting" | null;

const CONFIRM_MS = 3000;

function formOf(task: TaskDto | null): Form {
  return {
    title: task?.title ?? "",
    dueDate: task?.dueDate ?? "",
    note: task?.note ?? "",
    status: task?.status ?? "BACKLOG",
  };
}

export function TaskDialog({ task, onClose, onSave, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<Form>(formOf(null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirming, setConfirming] = useState(false);

  function stopConfirm() {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirming(false);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    stopConfirm();
    if (task) {
      setForm(formOf(task));
      setError(null);
      setBusy(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [task]);

  useEffect(() => stopConfirm, []);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<string | null>) {
    setBusy(kind);
    setError(null);
    const failure = await action();
    setBusy(null);
    if (failure) setError(failure);
    else onClose();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!task || busy) return;
    run("saving", () =>
      onSave(task.id, {
        title: form.title,
        dueDate: form.dueDate || null,
        note: form.note || null,
        status: form.status,
      }),
    );
  }

  function onDeleteClick() {
    if (!task || busy) return;
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(stopConfirm, CONFIRM_MS);
      return;
    }
    stopConfirm();
    run("deleting", () => onDelete(task.id));
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <dialog ref={ref} className="task-dialog" aria-labelledby="task-dialog-title" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <h2 id="task-dialog-title">Edit task</h2>
        <label>
          Title
          <textarea
            required
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
          <button type="button" onClick={onDeleteClick} disabled={busy !== null}>
            {busy === "deleting" ? "deleting…" : confirming ? "Delete? yes" : "Delete"}
          </button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy !== null}>
            {busy === "saving" ? "saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
