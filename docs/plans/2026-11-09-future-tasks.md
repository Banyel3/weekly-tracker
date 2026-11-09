# Future tasks and add-from-calendar (autopilot, 2026-11-09)

Owner picks (Sized decisions, 2026-11-07/08), then "build the future task now on autopilot then merge":

- Data model: a new task status `FUTURE` (fifth status, not a board column).
- A dated Future task stays in Future while its date is in a later week; it appears in the morning digest by its
  due date. It does not count in the weekly review or stats (it was never planned).
- Auto-promotion: when a Future task's due date falls in the current week (or earlier), it moves to This week by
  itself. This runs in every hourly rollover run AND immediately when a Future task is saved with such a date
  (owner pick B: "dynamic and just works").
- Calendar: clicking a day opens the add dialog with that due date. A day in the current week (or earlier) creates
  the task in This week; a day in a later week creates it in Future.
- Undated Future tasks stay in Future until moved by hand.

No separate spec: this plan and the owner's picks above are the authority.

## Global Constraints

- Repo `/home/ban/weekly-tracker`, base `main` (af5ae77). Toolchain: npm with `package-lock.json`; `npm test`
  (vitest run); `npm run build` must pass; no CI. Prisma 6, Next.js 15, React 19, Tailwind v4, shadcn, dnd-kit,
  lucide via `components/ui/icon.tsx` only.
- Work only in the worktree `/home/ban/worktrees/future-tasks`. Never touch the live database, docker, or `.env`.
  Migrations are generated against a throwaway Postgres, never the running `weekly-tracker-db-1`.
- Week math: Asia/Manila, ISO weeks Monday to Sunday, using the existing helpers in `lib/week.ts`. "Current week or
  earlier" = due date on or before this week's Sunday (Manila).
- Status name for the agent API and tools: `future` (alongside `backlog`, `this_week`, `in_progress`, `done`).
- Events: treat FUTURE like BACKLOG for planned/unplanned. Any move from FUTURE or BACKLOG into THIS_WEEK or
  IN_PROGRESS records PLANNED; a move from THIS_WEEK or IN_PROGRESS into FUTURE records UNPLANNED; FUTURE <-> BACKLOG
  records neither. Auto-promotion records PLANNED for the promoted week.
- Copy: plain, short, lower-case friendly, no exclamation marks (PRODUCT.md).
- Commits conventional with a full-sentence body, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. If git has no identity, use
  `-c user.name="Ban" -c user.email="138186128+Banyel3@users.noreply.github.com"`; change no config. Do not push.

## Task table

| Task | Branch | model | where | reviewer model |
|---|---|---|---|---|
| 1 Data, API, promotion | `feat/future-data` from `main` | executor (Opus) | worktree: own PR | reviewer (Sonnet) |
| 2 Future page and dialog | `feat/future-page` stacked on 1 | executor (Opus) | same worktree, after 1 | reviewer (Sonnet) |
| 3 Click a calendar day to add | `feat/calendar-add` stacked on 2 | executor (Opus) | same worktree, after 2 | reviewer (Sonnet) |
| Final | all three | — | — | final-reviewer (Opus) |

## Task 1: FUTURE status, promotion, and the API

Files (expected): `prisma/schema.prisma` + a new migration, `lib/tasks.ts`, `lib/rollover.ts`, `lib/events.ts`,
`lib/review.ts`, `lib/insights.ts`, `lib/digest.ts`, `lib/agent/parse.ts`, `lib/agent/ops.ts`, `docs/agent-api.md`,
tests beside each.

1. Add `FUTURE` to the `Status` enum with an additive migration (generated against a throwaway Postgres).
2. `weekOfFor(FUTURE)` is null. Create and update accept `FUTURE`.
3. Save-time promotion: when a task is created or updated with status FUTURE (or is FUTURE and its due date changes)
   and its due date is on or before this week's Sunday, it is saved as THIS_WEEK with this week's Monday as `weekOf`,
   in the same transaction, with a PLANNED event.
4. Hourly promotion: `rolloverStaleTasks` (every run) also promotes FUTURE, non-archived tasks whose due date is on
   or before this week's Sunday to THIS_WEEK with this Monday as `weekOf`, recording PLANNED once per task. Use the
   same row locking and in-flight guard the rollover already uses, so concurrent runs promote and record once.
   Rollover never archives or returns FUTURE tasks otherwise.
5. The board API returns Future tasks in a separate `future` array (non-archived, status FUTURE), so the UI can show
   them; the four columns are unchanged and never contain FUTURE tasks.
6. Review, stats and insights exclude FUTURE tasks from planned, finished, overdue and carried counts. The morning
   digest includes FUTURE tasks in its due sections by due date like any open task, and does not count them as
   carried.
7. Agent: `future` maps to FUTURE in `lib/agent/parse.ts`; `list_tasks` can filter by it; `move_task` and
   `create_task` accept it (save-time promotion applies); tool descriptions and `docs/agent-api.md` mention it.
   `get_board` includes the `future` list.

Test cases (write these first, then make them pass):
- Create FUTURE with no due date -> stays FUTURE, `weekOf` null, not in any board column, in `future`.
- Create FUTURE due next week -> stays FUTURE; appears in `future`.
- Create FUTURE due this Thursday -> saved as THIS_WEEK, `weekOf` this Monday, one PLANNED event.
- Create FUTURE due last week -> saved as THIS_WEEK (overdue on the board).
- Update a FUTURE task's due date from next month to tomorrow -> becomes THIS_WEEK with PLANNED.
- Rollover on a Monday with a FUTURE task due that Wednesday -> promoted once, PLANNED once; running rollover again
  changes nothing and records nothing.
- Two concurrent rollover runs -> the task is promoted and recorded once.
- Rollover never archives, returns to Backlog, or bumps `rolloverCount` on a FUTURE task.
- Move THIS_WEEK -> FUTURE records UNPLANNED; FUTURE -> BACKLOG records nothing; FUTURE -> IN_PROGRESS records PLANNED.
- Review for this week ignores a FUTURE task that is overdue by date, and does not count it as planned.
- Digest lists a FUTURE task due tomorrow (e.g. Sunday digest, Monday task) under "due tomorrow".
- Agent: `move_task {status: "future"}` works; `list_tasks {status: "future"}` returns only Future tasks.

## Task 2: the Future page and the dialog

Files (expected): `app/future/page.tsx`, `components/future/*`, `components/shell/Sidebar.tsx`,
`components/shell/NavItem.tsx`, the phone tab bar / More sheet, `components/board/TaskDialog.tsx`,
`components/useBoard.ts` / `BoardProvider.tsx`, `components/calendar/*` (show dated Future tasks).

1. The sidebar's "Future tasks" item stops being a `soon` stub and links to `/future`, with a count badge of Future
   tasks. On phones it is reachable from the More sheet.
2. `/future` lists Future tasks: dated ones first by due date (each with a date badge), then undated ones by creation
   order. Each row shows title, project chip, priority flag like a board card.
3. An add button opens the task dialog in create mode preset to Future ("Add a task to Future"). The dialog's create
   mode keeps naming its column (FINDING-013), with Future as a possible preset.
4. Clicking a row opens the dialog in edit mode. The edit-mode status select includes Future. Saving a due date in
   this week shows the task leaving the list (it was promoted server-side) and appearing on the board.
5. Each row offers "move to this week" and "move to backlog" (and delete through the dialog), with the existing
   single-slot undo for moves and deletes.
6. The week calendar and month view show dated Future tasks on their day, visually marked as Future (muted, with
   a small Future label or icon), clickable to open the dialog.
7. Empty state: one plain line, e.g. "nothing parked for later".
8. Keyboard: every action reachable by keyboard, visible focus, 44px targets on coarse pointers.

Test cases: sorting (dated first by date, then undated by creation); count badge; the calendar includes FUTURE tasks
with a due date and excludes undated ones; edit-mode status options include Future; a move to This week removes the
row and undo puts it back.

## Task 3: click a calendar day to add

Files (expected): `components/calendar/WeekCalendar.tsx`, `components/calendar/DayColumn.tsx`, the month view,
`components/BoardProvider.tsx` (opening the create dialog with presets), `components/board/TaskDialog.tsx`.

1. Clicking an empty spot in a day (week calendar and month view) opens the create dialog with that due date preset.
2. Status preset: day on or before this week's Sunday -> This week; a later day -> Future. The dialog names the
   column it will land in ("Add a task to This week" / "Add a task to Future").
3. Each day exposes a keyboard-reachable add button ("Add task on Mon 10 Nov"), shown on hover/focus on pointer
   devices and always available on touch, so the day's chips and drag targets keep working.
4. Clicking an existing chip still opens that task; dragging chips between days still reschedules.

Test cases: preset status for a day this week, today, last week and next week; the due date preset matches the day
clicked (Manila, no off-by-one at midnight); clicking a chip does not open the create dialog.
