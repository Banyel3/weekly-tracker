---
name: Weekly Tracker
description: Project management for one person, with the week as the unit and a board that resets itself every Monday. Quiet, dark, evening-first product UI.
source: app/globals.css, themes/*.css, lib/themes.ts, components/ui/*, components/board/*, components/shell/*
colors:
  # Cosmic Night (default preset). Every preset defines the same names; see Themes.
  background: "oklch(0.1743 0.0227 283.7998)"
  foreground: "oklch(0.9185 0.0257 285.8834)"
  card: "oklch(0.2284 0.0384 282.9324)"
  popover: "oklch(0.2284 0.0384 282.9324)"
  muted: "oklch(0.2710 0.0621 281.4377)"
  muted-foreground: "oklch(0.7166 0.0462 285.1741)"
  secondary: "oklch(0.3139 0.0736 283.4591)"
  accent: "oklch(0.3354 0.0828 280.9705)"
  primary: "oklch(0.7162 0.1597 290.3962)"
  primary-foreground: "oklch(0.1743 0.0227 283.7998)"
  destructive: "oklch(0.6861 0.2061 14.9941)"
  border: "oklch(0.3261 0.0597 282.5832)"
  input: "oklch(0.3261 0.0597 282.5832)"
  ring: "oklch(0.7162 0.1597 290.3962)"
  sidebar: "oklch(0.2284 0.0384 282.9324)"
  chart-1: "oklch(0.7162 0.1597 290.3962)"
  chart-2: "oklch(0.6382 0.1047 274.9117)"
  chart-3: "oklch(0.7482 0.1235 244.7492)"
  chart-4: "oklch(0.7124 0.0977 186.6761)"
  chart-5: "oklch(0.7546 0.1831 346.8124)"
semantic:
  alert: "var(--chart-5)"
  status-backlog: "var(--project-slate)"
  status-this-week: "var(--chart-3)"
  status-in-progress: "var(--primary)"
  status-done: "var(--chart-4)"
  status-future: "var(--muted-foreground)"
  project-rose: "oklch(0.72 0.14 15)"
  project-amber: "oklch(0.80 0.12 80)"
  project-lime: "oklch(0.78 0.14 125)"
  project-teal: "var(--chart-4)"
  project-sky: "var(--chart-3)"
  project-violet: "var(--chart-2)"
  project-pink: "var(--chart-5)"
  project-slate: "oklch(0.62 0.03 283)"
typography:
  family: "Geist (next/font/google) via --font-sans, system-ui fallback"
  body: { size: 14px, line: 20px, weight: 400 }
  card-title: { size: 14px, line: 20px, weight: 500, clamp: 2 lines }
  heading: { size: 15px, line: 20px, weight: 600 }
  section-title: { size: 14px, line: 20px, weight: 500 }
  stat-number: { size: 24px, weight: 600, numerals: tabular }
  meta: { size: 12px, line: 16px, weight: 400, color: muted-foreground }
  group-label: { size: 11px, weight: 500, case: upper, tracking: wide }
rounded:
  base: "--radius 0.5rem (8px)"
  sm: "4px"
  md: "6px"
  lg: "8px — cards, inputs, undo line"
  xl: "12px — columns, stat cards, review cards"
  full: "chips, dots, badges"
spacing:
  unit: "4px"
  card-padding: "8px 10px"
  column-gap: "12px"
  surface-padding: "16px (stat and review cards), 24px (dialog)"
  page-padding: "24px, 16px under 600px"
motion:
  duration: "150ms"
  easing: "cubic-bezier(0.22, 1, 0.36, 1)"
  properties: "transform, opacity, colors"
  stagger: "<= 60ms"
  reduced: "no transforms; 150ms opacity fades only"
breakpoints:
  phone: "< 600px"
  tablet: "600–899px"
  desktop: ">= 900px (sidebar visible)"
  wide: ">= 1100px (three stat cards in a row, 240px sidebar)"
---

## Overview

A small personal workspace around a four-column weekly board: a nav sidebar, a stats row, a week calendar and the board on one page, plus a weekly review and an archive. Register: product. Reference feel: Linear in a dim room. The board disappears into the week; colour is spent on status, time and focus, never on decoration.

## Colour

Tokens are the shadcn variable set on `:root[data-theme="<preset>"]`, one file per preset in `themes/`, dark values only, mapped to Tailwind colours in `app/globals.css` (`bg-card`, `text-muted-foreground`, `border-border`, …). App tokens are declared after the presets so they win per theme:

- `--alert` (= `--chart-5`): over-limit WIP, overdue and due-today labels, urgent priority. The only "loud" colour.
- `--status-*`: the four column hues. Backlog slate, This week `--chart-3`, In progress `--primary`, Done `--chart-4`. They appear only as the 6px dot in a status chip and as the dot in the Status select; the chip text always names the status.
- `--project-*`: eight identity colours for project dots, the sidebar progress bars and the colour swatches. Never used for text, borders or status.

Surfaces step up from `--background` (page) to `--sidebar` / `--card` (sidebar, columns, stat and review cards, dialog) to `--muted` (task cards, skeletons). Borders are 1px `--border`; hover lifts a card border by mixing 15% white into it. Text is `--foreground` or `--muted-foreground`, both at least 4.5:1 on `--card` in every preset. `color-scheme: dark`; selection is `--primary` at 30%; the caret is `--primary`. Charts use `--chart-2` for planned and `--primary` for finished; earlier weeks in the trend chart are drawn at 55% (`color-mix`) so the current week stands out.

Manifests and `theme-color` cannot take OKLCH, so `lib/pwa.ts` keeps Cosmic Night `--background` as `#0f0f1a`.

## Typography

Geist through `next/font/google`, exposed as `--font-geist` and forced as `--font-sans` for every theme. Body 14/20. Card titles 14/20 medium, clamped to two lines, `overflow-wrap: anywhere`. Page and dialog headings 15/20 semibold. Section titles 14/20 medium. Meta lines, counts, dates and stat headings 12/16 in `--muted-foreground`. Sidebar group labels 11px medium upper-case with wide tracking (the only upper-case text). Numbers use `tabular-nums` everywhere they can change.

## Layout

- **Desktop (≥ 900px):** sticky sidebar (200px, 240px from 1100px) and a main area at 24px padding: stats row → week calendar → board, the board filling the rest of the viewport height with internal column scroll.
- **Tablet (600–899px):** top bar with the week range, bottom tab bar, board as a two-up carousel.
- **Phone (< 600px):** top bar, bottom tab bar, page order board → calendar → stats; the board is a one-up carousel with peeks of the neighbouring columns.
- Safe-area insets pad the top bar, the navigation sheet, the tab bar, bottom sheets and the undo line, so the installed app (standalone, black-translucent status bar) never draws under system UI.

## Components

- **Task card:** `rounded-lg` `bg-muted` 1px border, padding 8px 10px. Row 1: priority flag slot and the title button. Row 2 (meta): project badge (outline badge with a project dot), due label (`overdue · Oct 29` / `today` in `--alert`), checklist count, rolled-over count, a `last week` tag for cards the rollover returned this Monday, and on phones a Move button. The flag slot is kept only when some card in the same column has a priority, so titles line up without an empty indent. Done cards keep full surface and border; the title drops to `--muted-foreground` and due labels are hidden.
- **Column:** `rounded-xl` `bg-card` 1px border. Header: status chip (outline badge, 6px `--status-*` dot, status name) and the count; In progress shows `n / 3` in `--alert` and the column border turns `--alert` when over the WIP limit. Empty column reads `nothing here`. A single ghost `Add` button at the foot opens the create dialog with that status preset. Drop target: border turns `--primary`.
- **Task dialog:** a 480px centred dialog on desktop, a bottom sheet with a drag handle on phones (`ResponsiveDialog`). Header: `New task` / `Edit task` / `Archived task` plus a one-line description (`Add a task to • Backlog`, the project name, or `Restore it to edit.`). Fields: Title (auto-growing), Project + Due date on one row, Priority as a three-segment toggle (None, High, Urgent with Flag icons; Urgent flag in `--alert`), Note, Checklist rows with `Add item`. Status appears only in edit mode; create mode takes the status from the column (or, from a calendar day, from the day's week). Footer: destructive text `Delete` on the left (edit), ghost `Cancel` and primary `Add` / `Save` on the right. The Project select offers `New project…`, which reveals a name input and the eight swatches. Closing returns focus to the opener (or the card's new position after a move); delete focuses the undo button.
- **Priority:** `PriorityFlag` is a Flag icon, muted for High, `--alert` for Urgent, with an `sr-only` "high priority" / "urgent priority" unless the same fact is already said in nearby text.
- **Badges:** outline `Badge` for status chips, project chips, the `Phase 3` tag and the carried-over count; filled `--primary` pill for the tab bar attention count; `soon` outline tag on disabled Phase 3 nav items.
- **Stats row:** three `StatCard`s (`rounded-xl` `bg-card` p-4, 12px muted heading with a right-aligned hint): This week (progress circle + finished of planned), Finished per day (seven bars, today in `--primary`), In progress (`n / 3`, overdue and carried counts). Over the limit the WIP card gets the one Aceternity effect allowed on screen, a moving border, and the number turns `--alert`. The row waits for both the board and the review so its first paint shows final numbers.
- **Week calendar:** Origin UI week view with Week / Month toggle. Day headers are buttons that filter the board to that day. Event chips are draggable to reschedule. Each day (week and month) has a ghost Plus button (`Add task on Mon 10 Nov`), shown on hover or focus with a mouse and always on touch; it, or a click in the day's free space, opens the create dialog with that due date, in This week up to this week's Sunday and in Future after it. Dated Future tasks show as fainter chips in `--muted-foreground` with a CalendarClock icon (`, future` for screen readers). With no due dates in the week it collapses to the header row plus one muted line: `no due dates this week · drag a card here or set a due date`.
- **Phone carousel:** scroll-snap columns at `100vw − 3rem` (two-up at `50vw − 1.875rem` on tablets) with symmetric peeks, a guide row above (previous label, current column with dot and count, next label) and page dots. Long-press without moving opens the Move sheet; dragging toward an edge pages after the finger has moved 8px.
- **Tab bar (< 900px):** five equal cells (Board, Calendar, Review, Archive, More), 56px plus the bottom inset, `bg-sidebar`; the current tab gets a 2px `--primary` top bar and `--primary` label. More opens the sidebar as a left sheet.
- **Sidebar:** week range heading with `N back from last week` under it, OVERVIEW nav (Board, Calendar, Future tasks, Weekly review, Archive with counts; the review shows an attention badge for tasks carried twice), TOOLS with the `Phase 3` tag and disabled `soon` items, Projects (filter buttons with done/planned and a thin progress bar in the project colour, a `…` menu for rename, colour and delete), and the theme picker at the foot.
- **Undo line:** popover surface, `rounded-lg`, 44px tall, pinned above the tab bar on phones and bottom-centre on desktop, max 480px. Copy is exact: `moved “<title>” to <Column> · undo`, `deleted “<title>” · undo`, `rescheduled “<title>” to <Mon d> · undo`. A thin bar shrinks over the 5-second window.
- **Search + Archive:** one input with a leading Search icon and `Search tasks` placeholder (label `sr-only`), and an outline `Archive` button beside it. The archive page lists past weeks newest first with the same search field; rows open the dialog read-only with Restore.
- **Hints:** `Hint` wraps a Radix tooltip at most 256px wide; icon-only buttons always have an `aria-label` and a hint.

## States

- Loading: two pulsing `bg-muted/60` skeleton cards per column, stat cards with `aria-busy`.
- Empty: `nothing here` (column), `nothing parked for later` (Future), `nothing archived yet`, `nothing planned yet`, `nothing carried over`, the collapsed calendar line.
- Errors: `couldn't load the board · retry`, `couldn't save · retry`, `couldn't load the numbers`.
- Nudge: `Rolled over N weeks in a row. Split it, shrink it, or let it go.` in the dialog for a task carried twice or more.
- Disabled: 50% opacity, no pointer events.
- Focus: 2px `--ring` outline at 2px offset (`:focus-visible`), or the shadcn 3px ring at 50% on inputs and selects.

## Motion

150ms `cubic-bezier(0.22, 1, 0.36, 1)` on transforms, opacity and colours only; list stagger at most 60ms (`AnimatedGroup`); cards travel between columns with Motion shared layout and a pointer drop fades in at the destination for one beat. Number changes tick for 150ms (`NumberTicker`, final value on first paint). Under `prefers-reduced-motion` a global rule turns transitions and CSS animations off and Motion components keep only opacity fades; the carousel scrolls without smooth behaviour.

## Icons

lucide-react only, rendered through `components/ui/icon.tsx`: sizes `sm` 14px, `md` 16px (default), `lg` 20px, stroke 1.75 with `absoluteStrokeWidth`, `aria-hidden` unless given a `label`. Icons sit beside text labels in nav, buttons and badges; an icon-only control carries an `aria-label`. No emoji, no filled icon sets, no custom glyphs in the UI. The app icon (`public/icons/`, rendered by `scripts/icons.sh`) is four rounded `--primary` bars on `--background`.

## Accessibility

Every interactive element is reachable by keyboard in visual order: sidebar → theme picker → calendar toggle and days → search and Archive → each column's cards and Add. Cards: Enter opens the dialog; Space picks up, arrows move between columns (or days in the calendar), Space drops, Escape cancels; focus follows the card to its new column. Live regions announce pick-up, hover target and the result (`"<title>" moved to This week.`) and the carousel announces the visible column. Targets are at least 44px under `(pointer: coarse)`. Status is always written in text beside its colour.

## Themes

Six presets, picked from the sidebar (`Theme · <Preset name>`), stored in `localStorage` under `theme` and applied before paint by an inline script: Cosmic Night (default), Mocha Mousse, Catppuccin, Graphite, Northern Lights, Amethyst Haze. Each preset file sets the full shadcn variable list; the picker previews `--primary`, `--card`, `--chart-3` and `--chart-5` from `lib/themes.ts`, which a test keeps in sync with the CSS.

## Do's and Don'ts

- Do spend colour on status, time and focus; keep project colours to dots, bars and swatches.
- Do write status in text beside its colour (`overdue · Oct 29`, `In progress` chip).
- Do keep one `Add` per column and one Aceternity effect on screen at a time.
- Don't add shadows except on floating layers (dialog, popover, undo line), and no gradients, glass or coloured column fills.
- Don't introduce a light theme, a second alert colour, or emoji in the UI.
- Don't open a modal for anything except creating, editing or moving a task.
