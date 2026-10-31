# Phase 2 design: a small personal project-management system

Date: 2026-10-31. Builds on the shipped weekly kanban (`docs/plans/2026-10-31-weekly-kanban.md`, `docs/plans/2026-10-31-projects.md`), PRODUCT.md and DESIGN.md. Research behind the choices: `.gstack/research/pm-tools-comparison.md`, `.gstack/research/personal-pm-practices.md`.

## Intent and why

The board works but fills the whole screen with four columns and little else. The owner wants the board to be one part of a denser personal workspace: what is due and in motion today, where each project stands, a view of the week's due dates, and the small habits that keep a solo system honest (a WIP limit, undo, a weekly review). Research on solo use says capture friction and backlog rot are what kill personal systems, so every addition here is either derived from existing data or optional per task, and every new view has a weekly use.

Visual reference the owner pointed at: the Synchro board on Dribbble (sidebar, calendar strip above the board, colored status chips, more color overall). We keep the evening-first dark theme and the existing tokens; the color budget grows deliberately by four status hues on column chips and the eight existing project colors.

## Goals

- Board shares the screen with a left sidebar (Today, Projects) and a week strip above it.
- Status gets color: one hue per column, on the column header chip only.
- Search and filter across the live board and the archive; projects filter the board.
- Per task: priority (none / high / urgent) and a checklist.
- Habits: soft WIP limit on In progress, undo for move and delete, a weekly review page and a Friday Telegram summary, a carry-over counter that nudges after repeated rollovers.
- Project management: rename, recolor, delete.

## Non-goals (Phase 3 and later)

Quick capture with inline parsing and keyboard shortcuts / command palette; recurring tasks; Telegram morning digest with buttons and `/add` `/today` `/week`; Someday/Maybe parking and backlog aging; waiting-for flag; estimates and capacity hints; calendar month view or iCal; light theme.

## Anti-goals

Team fields (assignees, comments), custom statuses or columns, nested subtasks (a checklist is flat), tags on top of projects, Gantt or dependencies, time tracking, any settings page. If a control does not move a card, change one of its fields, or run one of the three rituals (triage, review, plan), it does not exist.

## Constraints

- Stack unchanged: Next.js 15 App Router, Prisma 6, Postgres 16, dnd-kit, node-cron, Docker Compose. No new runtime dependencies except what is named here (none expected).
- Asia/Manila ISO weeks, Monday rollover, `dateToYmd` / `ymdToDate` wire format, all unchanged.
- Scale target: 10–20 live tasks, 2–4 projects, a growing archive (hundreds of rows a year). No pagination on the board; the archive list is paginated by week.
- Single user; no auth. Telegram stays optional and silent when unconfigured.
- Accessibility as before: keyboard paths for every new control, visible focus, status conveyed in text as well as color, 44px targets on coarse pointers, reduced motion honored.

## Data model changes (all additive)

On `Task`:
- `priority Priority @default(NONE)` with `enum Priority { NONE HIGH URGENT }`.
- `checklist Json @default("[]")`: array of `{ id: string, text: string, done: boolean }`, max 20 items, text max 120 chars. Order is array order.
- `rolloverCount Int @default(0)`: incremented by the rollover for each task it returns to Backlog; reset to 0 when the task is archived (Done). Never shown as a number, only as the nudge below.
- `completedAt DateTime?`: set when status becomes DONE, cleared when it leaves DONE. Lets the review count "finished this week" even before the Sunday archive.

On `Project`: nothing new. Deleting a project uses the existing `SetNull` relation.

Migration name `phase2`. Existing rows get the defaults.

## Layout

Desktop (≥ 1100px):

```
+------------+------------------------------------------------------+
| sidebar    | week strip: Mon 26 · Tue 27 · Wed 28 · Thu 29 ...    |
| 240px      +------------------------------------------------------+
|            | Backlog ○ | This week ○ | In progress ○ | Done ○     |
| Today      |  cards    |  cards      |  cards        |  cards     |
|  overdue   |           |             |               |            |
|  due today |           |             |               |            |
|  in prog.  |           |             |               |            |
| Projects   |           |             |               |            |
|  ● Home 2/5|           |             |               |            |
|  ● Work 1/3|           |             |               |            |
| Review →   |           |             |               |            |
+------------+------------------------------------------------------+
```

- The header line (week range, "N back from last week") moves to the top of the sidebar. The board region fills the rest of the viewport; columns scroll internally as today.
- 900–1100px: sidebar narrows to 200px, project progress bars hide (counts stay).
- Under 900px: sidebar becomes a collapsible panel above the strip (Today counts and project chips in one row; tap expands). Strip scrolls horizontally. Board stacks as today.

### Sidebar

- **Today**: three short lists, each a heading with count: Overdue (due before today, not Done, not archived), Due today, In progress. Items show priority dot, title, project dot. Clicking opens the task dialog. Empty sections collapse to the heading with `0`. Hidden entirely only when all three are empty, replaced by one muted line `nothing due today`.
- **Projects**: each row is a color dot, name, and `done/total` for tasks with `weekOf` = current week (Backlog tasks do not count); a thin 2px progress bar under the name in the project color. Clicking a row toggles the board's project filter (row gets a selected background; a `clear` text button appears at the top of the board). A `…` button per row opens a small inline menu: Rename, Recolor (the eight swatches), Delete (two-step, `Delete? yes`; tasks keep existing with no project). `+ project` at the bottom opens the same name + swatches form inline.
- **Review →** link to `/review`. When the current week has rolled over tasks with `rolloverCount ≥ 2`, the link shows a small count badge in the accent color.

### Week strip

- Seven cells Monday to Sunday, each with weekday abbreviation, day number, and the count of tasks due that day (not archived, any status). Today's cell has an accent underline; past days are muted; a cell with overdue-and-not-done tasks shows the count in accent.
- Clicking a cell toggles a day filter: the board shows only tasks due that day (all columns), the cell is selected, and the `clear` button appears. Only one of day filter, project filter and search is active at a time; activating one clears the others.
- Keyboard: cells are buttons; arrow keys move between them.

### Board changes

- Column header chip: a pill with a 6px colored dot and the label, hues: Backlog `oklch(0.72 0.02 250)` (slate), This week `oklch(0.75 0.11 230)` (sky), In progress `oklch(0.78 0.13 75)` (the existing accent), Done `oklch(0.78 0.14 125)` (lime). These four hues appear on the column chips only, never on cards. The accent remains the single interaction color (focus, drag, overdue/today).
- The board narrows; column min width 220px; under that the board scrolls horizontally inside its region.
- **WIP limit**: In progress has a soft limit of 3. At 4 or more the chip shows `4 / 3` and the column header border turns accent; nothing is blocked. The limit is a constant in code, not a setting.
- **Search**: a search field above the board (right side, `/` focuses it in Phase 3; for now click). Typing filters cards by title and note, case-insensitive, live. A `in archive` toggle beside it switches the main region to the Archive list (below).
- **Undo**: moving a card (drag or keyboard) and deleting a task show a 5-second line under the board header, `moved "Pay rent" to Done · undo` or `deleted "Pay rent" · undo`. Delete becomes deferred: the card disappears immediately, the DELETE request is sent after 5 seconds unless undone. Only the latest action is undoable; a new action replaces the line. The two-step `Delete? yes` in the dialog is removed in favor of undo.

### Card

- Priority dot before the title: none shows nothing; High a filled `--muted` dot; Urgent a filled accent dot plus the word `urgent` in the meta row (text as well as color).
- Checklist progress in the meta row as `2/5` when the checklist is non-empty; `5/5` is muted.
- Carry-over nudge: a task with `rolloverCount ≥ 2` shows a muted `↩ 2` in the meta row and the dialog shows one line: `Rolled over 2 weeks in a row. Split it, shrink it, or let it go.` No action is forced.
- Cards keep the project chip, due label, note marker and rolled-back tag from before.

### Dialog

- Fields in order: Title, Project, Priority (three radio pills: none, high, urgent), Due date, Note, Checklist, Status.
- Checklist: list of items each with a checkbox, text input and a remove `×`; `+ item` adds a focused empty row; Enter in an item adds the next; pasting multi-line text into an empty item creates one item per line. Max 20 items.
- Save/Add unchanged. Delete button sends the deferred delete and closes, showing the undo line.

### Ordering within a column

Priority first (urgent, high, none), then the existing rules (rolled-back first in Backlog, due date asc nulls last, created asc). Server-side in `listBoard`.

### Archive view

- Toggled from the search field's `in archive` switch, or `/archive` directly. Replaces the board region with a list grouped by week (`Week of Oct 19 – Oct 25`), newest first, 8 weeks per page with a `older` button. Each row: title, project chip, priority dot, completed date. The search box filters it the same way. Rows open the task dialog read-only except two actions: `restore to Backlog` (unarchives, status Backlog, weekOf null) and Delete.
- Route handler: `GET /api/archive?q=&before=YYYY-MM-DD&limit=` returns archived tasks ordered by `weekOf desc, completedAt desc`.

### Weekly review

- Page `/review` (linked from the sidebar). Three sections for the current week, computed live:
  1. **This week so far**: finished N of M planned (M = tasks with `weekOf` = this week, N = those with status Done), per project as a small table with progress bars; overdue count.
  2. **Carried over**: tasks with `rolledBackAt` = this Monday, each with its `rolloverCount`; a `nudge` label on those ≥ 2. Each row has three quick actions: `This week` (sets status), `keep in Backlog`, `delete` (deferred, undoable).
  3. **Last week**: finished / planned from the archive for the previous ISO week (archived Done tasks whose `weekOf` = last Monday, plus tasks rolled back on this Monday as "carried").
- **Friday summary** (Telegram, optional like reminders): cron `0 18 * * 5` Asia/Manila. Text: `Week of Oct 26: finished 7 of 10 · 2 in progress · 1 overdue` then one line per project `Home 3/4`, `Work 4/6`, then `Carried over twice or more: Renew passport`. Sent only when both Telegram variables are set; skipped silently otherwise.

## API changes

- `GET /api/board` additionally returns `today: "YYYY-MM-DD"` (Manila) so the client does not compute it. Tasks carry `priority`, `checklist`, `rolloverCount`, `completedAt`.
- `POST /api/tasks` and `PATCH /api/tasks/[id]` accept `priority` and `checklist` (validated: array ≤ 20, item `{ id, text ≤ 120, done }`).
- `PATCH /api/tasks/[id]` with `archived: false` restores (sets status Backlog, weekOf null, completedAt null).
- `PATCH /api/projects/[id]` `{ name?, color? }` → 200 / 404 / 409; `DELETE /api/projects/[id]` → 204.
- `GET /api/archive` as above. `GET /api/review` returns the three review sections as JSON so the page and the Friday cron share one function (`lib/review.ts`).

## Scheduler changes

- Rollover: the non-Done `updateMany` also does `rolloverCount: { increment: 1 }`; the Done/archive call sets nothing new (`completedAt` already set when the task became Done).
- New cron `0 18 * * 5` Asia/Manila → `sendWeeklySummary()`, registered under the same Telegram guard as the reminder.

## Calls I made (mark for the owner to check)

- Priority levels are none/high/urgent (two visible levels) rather than P1–P4; research says more levels go unused.
- Checklist is a JSON column, not a table. At ≤ 20 items per task a table buys nothing.
- WIP limit fixed at 3 in code. A setting would be the first settings surface; the spec forbids it.
- Undo replaces the two-step delete confirm. One safety mechanism, used everywhere.
- Only one filter active at a time (project, day, or search). Composable filters are team-tool territory for this scale.
- Review is a page, not a modal, because it has three sections and quick actions.
- Friday 18:00 Manila for the summary; Monday 00:00 already belongs to rollover.
- Status chip hues are the only place status color appears; cards stay neutral so the eight project colors keep their meaning.
- The archive stores nothing new; "finished last week" is derived from `weekOf` plus `archived`.

## Builder-check answers (my calls)

- **"Carried over" means three things, defined once.** The review's Carried over section lists every task with `rolledBackAt` = this Monday regardless of its current status, showing the status; the quick actions appear only on rows still in Backlog. The sidebar badge and the Friday "twice or more" line count tasks with `rolloverCount ≥ 2` that are still in Backlog (acting on a task removes it from the nudge). "Last week planned" = archived Done tasks with `weekOf` = last Monday plus tasks with `rolledBackAt` = this Monday.
- **Undo and reload.** A pending delete is flushed with `fetch(..., { keepalive: true })` on `pagehide`, so closing the tab still deletes. `useBoard` keeps a pending-delete id set and filters it out of refetch results. Move undo restores the full prior task snapshot (status, weekOf, completedAt, rolledBackAt) via one PATCH, not just status. The review page reuses the same hook and undo line.
- **`completedAt` backfill.** The migration sets `completedAt = "updatedAt"` for rows where `status = 'DONE'` (archived or not). The archive still falls back to `weekOf` if `completedAt` is null.
- **Archive API.** `limit` counts weeks (default 8); `before` is a week-start cursor (exclusive). `q` applies across all weeks before paging.
- **One shared layout.** `app/layout.tsx` renders the sidebar and week strip for `/`, `/archive`, `/review`. The archive is a route; the `in archive` toggle navigates. Filters (project, day, search) reset on navigation.
- Rename to an existing project name → 409. `rolloverCount` is untouched by restore from archive. The strip shows the current week only.

## Left to the builder

Exact CSS for the sidebar and strip within the existing tokens; the sidebar's collapsed layout under 900px; empty states copy beyond those given here; how the undo timer is implemented; the shape of `lib/review.ts` as long as the page and the cron share it; test coverage for pure functions (review math, checklist validation, priority ordering).
