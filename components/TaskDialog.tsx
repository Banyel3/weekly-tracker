"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TaskDto } from "@/lib/tasks";

type Status = TaskDto["status"];
export type StatusOption = { status: Status; label: string };
export type DialogState = { mode: "create" } | { mode: "edit"; task: TaskDto };

type Props = {
  state: DialogState | null;
  statuses: StatusOption[];
  onClose: () => void;
  onSaved: () => void;
};

type Form = { title: string; dueDate: string; note: string; status: Status };

function initialForm(state: DialogState | null): Form {
  if (state?.mode === "edit") {
    const { title, dueDate, note, status } = state.task;
    return { title, dueDate: dueDate ?? "", note: note ?? "", status };
  }
  return { title: "", dueDate: "", note: "", status: "THIS_WEEK" };
}

export function TaskDialog({ state, statuses, onClose, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Form>(initialForm(null));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (state) {
      setForm(initialForm(state));
      setError(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [state]);

  async function send(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    if (res.ok) {
      onSaved();
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.error ?? `Request failed (${res.status})`);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!state) return;
    const payload = {
      title: form.title,
      dueDate: form.dueDate || null,
      note: form.note || null,
      status: form.status,
    };
    const isEdit = state.mode === "edit";
    await send(isEdit ? `/api/tasks/${state.task.id}` : "/api/tasks", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function onDelete() {
    if (state?.mode !== "edit") return;
    await send(`/api/tasks/${state.task.id}`, { method: "DELETE" });
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <dialog ref={ref} className="task-dialog" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <h2>{state?.mode === "edit" ? "Edit task" : "New task"}</h2>
        <label>
          Title
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
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
            {statuses.map(({ status, label }) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          {state?.mode === "edit" && (
            <button type="button" className="danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
