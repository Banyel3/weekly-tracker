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

Quick capture with inline parsing and keyboard shortcuts / command palette; recurring tasks; notifications beyond the current Telegram reminder and Friday summary: a Telegram morning digest with Done/Snooze buttons and `/add` `/today` `/week` commands (long-polled from inside the container, no inbound port), plus Web Push from the app itself (service worker + VAPID; HTTPS via `tailscale serve`; on iOS only when added to the Home Screen), chosen by the owner on 2026-11-03 over ntfy/Pushover; **Future tasks** (owner request 2026-11-03; replaces the generic Someday/Maybe item): a parking list for anything non-urgent you want to do eventually, outside the board and never rolled over; it surfaces itself on easy days (when nothing is due today and This week has fewer than 3 open tasks, or the morning digest finds nothing due) with a prompt like `easy day · pick a future task`, offers one or two random items with a one-click move to This week, and shows a count in the sidebar; backlog aging nudges stale Backlog items toward it; waiting-for flag; estimates and capacity hints; iCal feed; light theme variants; Tailscale Funnel or any public exposure; auth. The sidebar shows the Phase 3 items as disabled entries so the shell is final now.

## Anti-goals

Team fields (assignees, comments), custom statuses or columns, nested subtasks (a checklist is flat), tags on top of projects, Gantt or dependencies, time tracking, any settings page. If a control does not move a card, change one of its fields, or run one of the three rituals (triage, review, plan), it does not exist.

## Constraints

- Stack: Next.js 15 App Router, Prisma 6, Postgres 16, dnd-kit, node-cron, Docker Compose, plus the Phase 2 UI stack chosen on 2026-11-01: Tailwind v4 + shadcn/ui as the base; Magic UI (animated numbers, lists, bento), Aceternity UI (one or two accent effects only), Motion Primitives (general motion, built on `motion`), Origin UI event calendar (shadcn-based), Tremor (charts), tweakcn theme presets. Plain-CSS `globals.css` migrates to Tailwind + shadcn tokens in the first task; the existing design rules (no shadows beyond the preset's, 150ms ease-out, reduced motion, 44px targets, text-plus-color status) still bind.
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

## Layout (v2, approved on the canvas 2026-11-01)

Reference canvas: https://claude.ai/artifact/C3Cn3c7q3mjexgM1M4MhPU (Main, Dialog, Review artboards). Visual references: Synchro board (dribbble 27058593) for structure, "Task Board in Dark Mode" (dribbble 25448854) for mood.

Desktop (≥ 1100px):

```
+------------+------------------------------------------------------------+
| sidebar    | [This week ring 3/10] [Finished per day ▁▃▁▁▃▁▂] [WIP 4/3 · Overdue 1]
| 240px      +------------------------------------------------------------+
| OVERVIEW   | Week calendar: MON 26 | TUE 27 | ... | SAT 31 (today) | SUN 1 |
|  Board     |   event chips by due date, project-colored, drag to move   |
|  Calendar  +------------------------------------------------------------+
|  Review  2 | Board · undo line · search · archive link                 |
|  Archive   | Backlog ○ | This week ○ | In progress ○ | Done ○           |
| TOOLS·P3   |  cards (compact)                                           |
|  (disabled)|                                                            |
| Projects   |                                                            |
| Theme ▾    |                                                            |
+------------+------------------------------------------------------------+
```

The board is about a third of the viewport height; the stats row and the week calendar take the rest. Under 1100px the stats row wraps to 2+1, the calendar scrolls horizontally, the board stacks as today. Under 900px the sidebar collapses to a top bar with a menu button.

### Sidebar (navigation, not a task list)

- Header: week range (h1, 15/500) and the muted `N back from last week` line.
- **Overview**: Board (count of live tasks), Calendar (scrolls to / focuses the calendar section), Weekly review (badge = Backlog tasks with `rolloverCount ≥ 2`), Archive (count). Current page highlighted with the theme's `accent` surface.
- **Tools · Phase 3**: Inbox / quick capture, Recurring tasks, Telegram digest, Someday / maybe, Shortcuts ⌘K. Rendered as disabled buttons with a `soon` tag; no routes behind them. They exist so the shell does not change shape when Phase 3 lands.
- **Projects**: each row is a color dot, name, `done/total` for `weekOf` = current week, and a 3px progress bar in the project color. Clicking toggles the board and calendar project filter. `…` menu: Rename, Recolor (eight swatches), Delete (deferred, undoable). `+ project` opens the inline name + swatches form.
- Footer: `Theme · <preset> ▾` opens the theme picker (below).

### Stats row (Tremor)

Three cards, left to right:
1. **This week**: `ProgressCircle` with the percentage inside; `N of M finished`; `day d of 7 · on pace for K` where K = round(N / d × 7).
2. **Finished per day**: a 7-bar `BarChart` of tasks whose `completedAt` falls on each of the last 7 days (Manila), today's bar in `primary`, zero days as a 2px baseline. Weekday initials under the bars.
3. **In progress / Overdue**: two KPIs. In progress shows `n / limit` in the alert color when over, with the line `finish one before starting`; Overdue shows the count and `k carried over`.

Numbers animate with Magic UI's number ticker on mount and on change; Motion Primitives handles the card entrance (one stagger, 150ms ease-out, none under reduced motion). The WIP card gets Aceternity's moving border only while over the limit.

### Week calendar (shadcn-style event calendar, week view)

- Origin UI's event calendar (shadcn-based) in week view, Monday to Sunday, all-day rows only (tasks have dates, not times). Each task with a due date appears as an event chip in its day: project-colored tint with a 3px edge, done tasks struck through at 55% opacity, overdue (past and not Done) with the alert-colored edge. Today's column is tinted and its date sits in a `primary` pill.
- Drag a chip to another day → `PATCH { dueDate }` (optimistic, undoable). Click a chip → task dialog. Click a day header → day filter on the board (one filter at a time, as before). Week / Month toggle in the header; Month is the same component's month view, read-only except click-to-open.
- Keyboard: day headers and chips are focusable; arrows move between chips, Enter opens.

### Theme (tweakcn presets)

- Themes are shadcn CSS-variable sets from tweakcn. Shipped presets: **Cosmic Night** (default), plus five more chosen at build time (candidates: Mocha Mousse, Catppuccin, Graphite, Northern Lights, Amethyst Haze). Each preset is a JSON of `--background … --chart-5 --sidebar-*` values stored under `themes/`; the picker in the sidebar footer swaps the `data-theme` attribute on `<html>` and saves the choice in `localStorage`. Dark mode only in Phase 2; light variants of presets are out of scope.
- Geist stays the UI font regardless of the preset's `--font-sans`.
- Semantic mapping on top of the preset: `primary` = interaction (focus ring, selected, today, In progress marker, buttons); `chart-5` (or the preset's warmest chart hue) = alert (overdue, today-due, urgent, WIP over limit); `chart-3/4` and friends = project palette defaults; `destructive` only for the confirm-free delete's undo line emphasis. Project colors are stored as keys and resolved per theme so they always read against the current surfaces.

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

## Honest insights (added 2026-11-03)

The review must distinguish where work came from. Tasks carry an append-only event log (created, planned, unplanned, started, done, reopened, rescheduled, rolled back, archived, deleted, restored) written by the existing mutation paths and backfilled from current fields. From it the review reports planned-by-origin (carried in vs added this week, and finished by origin), flow times (median added→done, median in progress, reopened), procrastination signals (reschedules, overdue days before done, rolled twice, oldest Backlog age, mid-week additions), an eight-week planned-vs-finished trend, and one neutral pattern sentence per week. Tone is observational only: no scores, streaks or red/green judgement. Details: `docs/plans/2026-11-01-phase-2.md` Task 7c.

## Deployment: laptop server on the tailnet

The app will move from this machine to a laptop that stays on and is reached over Tailscale. Phase 2 prepares for that without changing the one-command promise.

- **Binding**: compose publishes the app on `127.0.0.1:3000:3000` (loopback only) so nothing is exposed on the LAN; Tailscale provides the reachable endpoint. The db port mapping (`5433`) becomes optional via a `docker-compose.dev.yml` override, not published by default.
- **HTTPS and hostname**: the host runs the Tailscale client; `tailscale serve --bg 3000` (one command, documented in the README) gives `https://<laptop>.<tailnet>.ts.net` with managed certificates. Secure context matters: `crypto.randomUUID`, clipboard and service-worker APIs need it. No Funnel (public exposure) by default.
- **Trust boundary**: the tailnet is the login. No auth in the app. Optional later: read Tailscale's identity headers behind `tailscale serve` to show who is connected or restrict to one user.
- **Restart and sleep**: `restart: unless-stopped` on both services (today only `app` has it); Docker Desktop or the Docker daemon set to start at boot, documented. Because a sleeping laptop misses the Monday 00:00 cron, the rollover also runs an idempotent hourly check (`0 * * * *`) in addition to the weekly cron and the startup catch-up; the Friday summary and the daily reminder stay single-shot crons but each also checks on startup whether its slot was missed today and sends once if so (guarded by a `lastSentOn` row in a small `AppState` table).
- **Backups**: `scripts/backup.sh` runs `pg_dump` inside the db container to `./backups/weekly-tracker-<date>.sql.gz` and keeps 30 days; README documents a host cron line and the restore command. No cloud sync in scope.
- **Health**: the app gets a `/api/health` route (DB ping, current week start, last rollover run) and a compose healthcheck on it; `docker compose ps` shows real health.
- **Config**: `.env.example` gains `APP_TZ` (fixed to Asia/Manila, informational), `BACKUP_KEEP_DAYS=30`, and the Telegram variables as before. `NEXT_TELEMETRY_DISABLED=1` in the Dockerfile.
- **Move procedure** (README): on the old machine `scripts/backup.sh`; on the laptop clone, copy `.env`, `docker compose up -d --build`, `scripts/restore.sh <file>`, `tailscale serve --bg 3000`. Image builds locally on the laptop, so CPU architecture does not matter.

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
