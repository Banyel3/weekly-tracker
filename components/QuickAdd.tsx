"use client";

import { useState, type KeyboardEvent } from "react";

type Props = { onAdd: (title: string) => void };

export function QuickAdd({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  function close() {
    setOpen(false);
    setTitle("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle("");
  }

  if (!open) {
    return (
      <button type="button" className="quick-add" onClick={() => setOpen(true)}>
        + add
      </button>
    );
  }

  return (
    <input
      className="quick-add-input"
      aria-label="New task title"
      placeholder="title"
      maxLength={200}
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        if (!title.trim()) close();
      }}
    />
  );
}
