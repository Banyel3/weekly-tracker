---
name: Weekly Tracker
description: Single-user weekly kanban. Quiet, dark, evening-first product UI.
colors:
  bg: "oklch(0.19 0.008 70)"
  column: "oklch(0.22 0.008 70)"
  card: "oklch(0.26 0.008 70)"
  border: "oklch(0.32 0.008 70)"
  border-hover: "oklch(0.40 0.008 70)"
  text: "oklch(0.92 0.008 70)"
  muted: "oklch(0.68 0.01 70)"
  accent: "oklch(0.78 0.12 75)"
typography:
  body:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  card-title:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.43
  label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.33
  header:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: "6px"
  md: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  column:
    backgroundColor: "{colors.column}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  button-quiet:
    backgroundColor: "{colors.column}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
---
<!-- SEED: written from the 2026-10-31 design review decisions; re-run `$impeccable document` after Task 7 ships to capture real tokens. -->

## Overview

A four-column weekly kanban for one person, used in the evening in a dim room. Register: product. Reference feel: Linear. The board should disappear into the week: predictable structure, one accent reserved for time, no decoration.

## Colors

Warm-tinted dark neutrals on a single hue (OKLCH hue 70, chroma 0.008–0.01). Four stacked surfaces: `{colors.bg}` page, `{colors.column}`, `{colors.card}`, and borders at `{colors.border}` rising to `{colors.border-hover}` on hover. Text `{colors.text}` and `{colors.muted}` (about 5.5:1 on a card). One accent, `{colors.accent}` (muted amber, about 6.7:1 on a card), used only for overdue and today due-labels, the In Progress column marker, focus rings, drag and drop borders, selection and caret. Never pure black or white. `color-scheme: dark` so native controls match.

## Typography

Geist Sans, loaded with `next/font/google`, system sans fallback. One family, four roles: body 14/20, card title 14/500, labels 12/600 sentence case in muted, header 15/500. Counts and dates use `font-variant-numeric: tabular-nums`. Card titles clamp to two lines.

## Elevation

No shadows. Depth comes from the four surface steps and 1px borders. Dragging raises nothing; it changes the border to the accent. Drop targets change the column border only, never the fill. Motion is 150ms ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`) on border-color and opacity, none under `prefers-reduced-motion`.

## Components

- **Card**: `{components.card}`, 1px `{colors.border}`, title plus optional due label. Done cards at 60% text opacity.
- **Column**: `{components.column}`, sticky label row with count, internal scroll, quick-add row pinned at the bottom.
- **Quick-add**: muted `+ add` text that becomes a single `{components.input}`; Enter saves, Esc cancels.
- **Dialog**: native `<dialog>` on `{colors.column}` with 1px border; edit only; two-step delete.
- **Buttons**: `{components.button-quiet}`; primary emphasis via weight 500, not color. Disabled at 50% opacity.

## Do's and Don'ts

- Do keep the accent for time and focus only.
- Do convey status in text as well as color (`overdue · Oct 29`).
- Do keep 4px spacing steps and 6px/8px radii.
- Don't add shadows, gradients, glass, icons, emoji, or colored left borders.
- Don't introduce a second accent, uppercase labels, or a light theme.
- Don't open a modal for creation; the dialog is for editing.
