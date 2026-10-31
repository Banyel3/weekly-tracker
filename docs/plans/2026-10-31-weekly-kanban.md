# Weekly To-Do Kanban Tracker — Implementation Plan

Date: 2026-10-31
Spec: the user's request (verbatim) is in `docs/plans/2026-10-31-spec.md`. The spec is the binding authority; this plan is its argument.

## Summary

Single-user, self-hosted weekly kanban. Next.js 15 (App Router, TypeScript) full-stack, PostgreSQL via Prisma 6, Docker Compose with a named volume. Four columns (Backlog | This Week | In Progress | Done); the three week columns are scoped to the current ISO week in Asia/Manila; Backlog is persistent. Weekly auto-rollover via node-cron plus a startup catch-up pass. Optional Telegram daily reminder. No auth, no settings, no seed data.

## Global Constraints

These bind every task. Exact values; use verbatim.

- **Scope discipline:** build exactly the spec. No auth, no multi-user, no settings pages, no seed data, no reordering within a column, no extra pages. If a task is tempted to add a feature not in the spec, do not.
- **Timezone constant:** `export const TIMEZONE = "Asia/Manila"` in `lib/week.ts`. Every date computation (current week, "today", cron schedules) uses this constant explicitly via `date-fns-tz`; never rely on the process TZ.
- **Week semantics:** ISO week, Monday start. `weekOf` is the Monday date of the task's week, stored as `DateTime? @db.Date`. It is `null` for `BACKLOG` tasks and set to the current week's Monday whenever a task is created in or moved to `THIS_WEEK`, `IN_PROGRESS`, or `DONE`.
- **Date wire format:** all dates (`weekOf`, `dueDate`, week range) cross the API as `"YYYY-MM-DD"` strings or `null`. Helpers `dateToYmd(d: Date): string` (uses `toISOString().slice(0, 10)`) and `ymdToDate(ymd: string): Date` (returns `new Date(ymd + "T00:00:00.000Z")`) live in `lib/week.ts`. Prisma `@db.Date` columns round-trip through these two helpers only.
- **Status enum (Prisma):** `enum Status { BACKLOG THIS_WEEK IN_PROGRESS DONE }`.
- **Prisma model:**
  ```prisma
  model Task {
    id        String    @id @default(cuid())
    title     String
    note      String?
    dueDate   DateTime? @db.Date
    status    Status    @default(BACKLOG)
    weekOf    DateTime? @db.Date
    archived  Boolean   @default(false)
    createdAt DateTime  @default(now())
    updatedAt DateTime  @updatedAt
  }
  ```
- **Board query:** visible tasks are `archived = false` AND (`status = BACKLOG` OR `weekOf = currentWeekMonday`). Order by `dueDate asc nulls last`, then `createdAt asc`.
- **Rollover rule** (idempotent; safe to run any number of times): for tasks with `archived = false` and `weekOf < currentWeekMonday`: if `status = DONE` → set `archived = true`; otherwise → set `status = BACKLOG`, `weekOf = null`. Implemented as two `updateMany` calls, no per-row loop.
- **Rollover schedule:** node-cron expression `0 0 * * 1` with `{ timezone: "Asia/Manila" }`. Catch-up pass runs once at server start before the cron is registered.
- **Reminder schedule:** node-cron expression `0 9 * * *` with `{ timezone: "Asia/Manila" }`, registered only when both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are non-empty. "Due today" = `archived = false`, `status != DONE`, `dueDate = today(Asia/Manila)`. If no tasks are due, send nothing. Send via `fetch("https://api.telegram.org/bot<TOKEN>/sendMessage", { method: "POST", ... })` with JSON body `{ chat_id, text }`. Failures are logged with `console.error` and never thrown.
- **Scheduler entry point:** `instrumentation.ts` at the project root, `register()` guarded by `process.env.NEXT_RUNTIME === "nodejs"`, dynamic-imports `lib/scheduler.ts` and calls `startScheduler()`. A `globalThis` flag prevents double registration under dev HMR.
- **API routes:**
  - `GET /api/board` → `{ week: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }, tasks: TaskDto[] }`
  - `POST /api/tasks` body `{ title: string (1–200 chars, trimmed, required), note?: string | null, dueDate?: "YYYY-MM-DD" | null, status?: Status (default "BACKLOG") }` → `201 TaskDto`
  - `PATCH /api/tasks/[id]` body: any subset of `{ title, note, dueDate, status }` → `200 TaskDto`; `404` if missing. If `status` is present, `weekOf` is recomputed per Week semantics.
  - `DELETE /api/tasks/[id]` → `204`; `404` if missing.
  - Validation via `zod`; invalid body → `400 { error: string }`.
  - `TaskDto = { id, title, note: string | null, dueDate: string | null, status, weekOf: string | null, createdAt: string (ISO), updatedAt: string (ISO) }`.
- **Dependencies (exact majors):** runtime `next@15 react@19 react-dom@19 @prisma/client@6 prisma@6 @dnd-kit/core@6 @dnd-kit/utilities@3 node-cron@3 date-fns@4 date-fns-tz@3 zod@3`; dev `typescript@5 @types/node @types/react @types/react-dom @types/node-cron vitest@3`. `prisma` is a runtime dependency because the container runs `prisma migrate deploy`. No Tailwind, no ESLint, no other UI libraries. Styling is one `app/globals.css`.
- **next.config.ts:** `{ eslint: { ignoreDuringBuilds: true } }` only. Not standalone output.
- **Docker:** `docker-compose.yml` services `db` (image `postgres:16`, named volume `pgdata:/var/lib/postgresql/data`, `POSTGRES_USER=tracker`, `POSTGRES_PASSWORD=tracker`, `POSTGRES_DB=tracker`, healthcheck `pg_isready -U tracker -d tracker`, interval 5s, timeout 3s, retries 10, host port mapping `5433:5432`) and `app` (build `.`, port `3000:3000`, `depends_on: db: condition: service_healthy`, environment `DATABASE_URL=postgresql://tracker:tracker@db:5432/tracker`, `TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}`, `TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-}`, `restart: unless-stopped`). Top-level `volumes: pgdata:`.
- **Dockerfile:** base `node:22-bookworm-slim`, `apt-get install -y openssl`, two stages (`build`: `npm ci`, `npx prisma generate`, `npm run build`; `runner`: copies `node_modules`, `.next`, `public`, `prisma`, `package.json`, `next.config.ts`, `docker-entrypoint.sh`). `ENTRYPOINT ["./docker-entrypoint.sh"]`; the script runs `npx prisma migrate deploy` then `exec npm run start`. `NODE_ENV=production`.
- **`.env.example`:**
  ```
  DATABASE_URL=postgresql://tracker:tracker@localhost:5433/tracker
  TELEGRAM_BOT_TOKEN=
  TELEGRAM_CHAT_ID=
  ```
- **Commits:** Conventional Commits. Every commit message ends with the trailer line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Tests:** `vitest` unit tests for `lib/week.ts` only (pure date math). Everything that touches the database is verified manually against the compose `db` service, with the commands and output recorded in the task report. `npm test` runs `vitest run`.
- **Code style:** small files, one responsibility each. No comments that restate the code. No dead code, no TODOs.

- **Design tokens (added by /plan-design-review 2026-10-31; supersede any "light theme" wording in Task 4; DESIGN.md mirrors them):**
  - Theme: dark-first for evening use. `color-scheme: dark`. No pure black or pure white anywhere.
  - Colors (OKLCH, warm hue 70): `--bg oklch(0.19 0.008 70)`, `--column oklch(0.22 0.008 70)`, `--card oklch(0.26 0.008 70)`, `--border oklch(0.32 0.008 70)`, `--border-hover oklch(0.40 0.008 70)`, `--text oklch(0.92 0.008 70)`, `--muted oklch(0.68 0.01 70)`, `--accent oklch(0.78 0.12 75)`. The accent is used only for: overdue/today due labels, the In Progress column marker, focus rings, drag/drop borders, selection and caret. Nothing else is colored.
  - Type: Geist Sans via `next/font/google` (self-hosted at build; no runtime Google request), system sans fallback. Body 14px/20px. Card title 14px/500. Column label 12px/600 sentence case in `--muted`, count in `--muted` with `font-variant-numeric: tabular-nums`. Header h1 15px/500 in `--text`. Due labels 12px.
  - Spacing: 4px grid. Card padding 8px 10px; column padding 8px; column gap 16px; page padding 24px (16px under 600px). Card gap 6px.
  - Radius: card and inputs 6px; column 8px.
  - Motion: 150ms `cubic-bezier(0.22, 1, 0.36, 1)` on `border-color`, `opacity` only. Under `prefers-reduced-motion: reduce`, no transitions. dnd-kit transform is the only movement.
  - Browser surfaces: `::selection` background accent at 30% alpha; `caret-color: var(--accent)`; thin scrollbars tinted from `--border`; `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` on every focusable.
  - States: hover = border to `--border-hover`; dragging = border `--accent`, no shadow; drop target = column border `--accent`, no fill; Done cards = text at 60% opacity, due label hidden; disabled buttons = 50% opacity, `cursor: default`.

## File Layout

```
app/
  layout.tsx            root layout, imports globals.css
  page.tsx              renders <Board />
  globals.css
  api/board/route.ts
  api/tasks/route.ts
  api/tasks/[id]/route.ts
components/
  Board.tsx             client: board state (optimistic), DndContext + sensors, header, dialog target
  Column.tsx            client: useDroppable, sticky label, internal scroll, QuickAdd row
  QuickAdd.tsx          client: inline title input, Enter saves into its column
  TaskCard.tsx          client: useDraggable, title button, due label
  TaskDialog.tsx        client: edit form (title, due, note, status), two-step delete
  useBoard.ts           client: fetch/refetch/optimistic mutations hook
lib/
  db.ts                 Prisma client singleton
  week.ts               TIMEZONE, currentWeekStart, weekRange, todayYmd, dateToYmd, ymdToDate
  week.test.ts
  tasks.ts              toDto, listBoard, createTask, updateTask, deleteTask, weekOfFor(status)
  rollover.ts           rolloverStaleTasks
  reminders.ts          sendDueTodayReminder
  scheduler.ts          startScheduler
instrumentation.ts
prisma/schema.prisma
prisma/migrations/<timestamp>_init/migration.sql
prisma/migrations/migration_lock.toml
Dockerfile
docker-entrypoint.sh
docker-compose.yml
.env.example
.dockerignore
README.md
package.json, tsconfig.json, next.config.ts
```

## Task Table

| # | Task | model | where | reviewer model |
|---|------|-------|-------|----------------|
| 1 | Scaffold + Prisma schema/migration + `lib/week.ts` with tests | executor (opus) | in place | reviewer (sonnet) |
| 2 | Task data layer + API routes | executor (opus) | in place | reviewer (sonnet) |
| 3 | Rollover, reminders, scheduler, instrumentation | executor (opus) | in place | reviewer (sonnet) |
| 4 | Board UI with dnd-kit | executor (opus) | in place | reviewer (sonnet) |
| 5 | Docker, compose, env example, README; end-to-end boot + persistence check | executor (opus) | in place | reviewer (sonnet) |
| 6 | `rolledBackAt` field: migration, rollover sets it, status change clears it, DTO exposes it | executor (opus) | in place | reviewer (sonnet) |
| 7 | UI design pass: tokens, hierarchy, states, quick-add, optimistic moves, keyboard/touch/SR, responsive | executor (opus) | in place | reviewer (sonnet) |

Tasks run sequentially on branch `feat/weekly-kanban`. Final whole-branch review: final-reviewer (opus).

## Task 1: Scaffold + Prisma schema/migration + `lib/week.ts` with tests

**Goal:** A Next.js 15 TypeScript project that builds, with the Prisma schema, the initial migration, the Prisma client singleton, and the pure week/date helpers under unit test.

**Steps:**

1. Create `package.json` by hand (do not use interactive `create-next-app`). Name `weekly-tracker`, `"private": true`. Scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`, `"test": "vitest run"`, `"postinstall": "prisma generate"`. Install the dependencies listed in Global Constraints with `npm install` (runtime) and `npm install -D` (dev). Commit the resulting `package-lock.json`.
2. `tsconfig.json`: Next.js defaults (`strict: true`, `moduleResolution: "bundler"`, `jsx: "preserve"`, `paths: { "@/*": ["./*"] }`, include `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, exclude `node_modules`).
3. `next.config.ts` per Global Constraints.
4. `app/layout.tsx` (html lang `en`, body, imports `./globals.css`, metadata title `Weekly Tracker`) and a placeholder `app/page.tsx` that renders `<main>Weekly Tracker</main>` (Task 4 replaces it). `app/globals.css` with a minimal reset only (box-sizing, margin 0, system font stack); Task 4 adds the real styles.
5. `prisma/schema.prisma`: `generator client { provider = "prisma-client-js" }`, `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`, the `Status` enum and `Task` model from Global Constraints verbatim.
6. Create `.env` locally (git-ignored) with `DATABASE_URL=postgresql://tracker:tracker@localhost:5433/tracker`. Start a throwaway Postgres for migration generation: `docker run -d --name wt-pg -e POSTGRES_USER=tracker -e POSTGRES_PASSWORD=tracker -e POSTGRES_DB=tracker -p 5433:5432 postgres:16`, wait for `docker exec wt-pg pg_isready -U tracker`, then `npx prisma migrate dev --name init`. Commit `prisma/migrations/**`. Stop and remove the container when done (`docker rm -f wt-pg`). If host port 5433 is taken, use another host port and adjust `.env` for this step only.
7. `lib/db.ts`: standard Prisma singleton (`globalThis.prisma ??= new PrismaClient()` pattern, typed).
8. `lib/week.ts` exporting:
   - `export const TIMEZONE = "Asia/Manila"`
   - `dateToYmd(d: Date): string` and `ymdToDate(ymd: string): Date` per Global Constraints
   - `todayYmd(now: Date = new Date()): string` → `format(toZonedTime(now, TIMEZONE), "yyyy-MM-dd")`
   - `currentWeekStart(now: Date = new Date()): string` → `format(startOfISOWeek(toZonedTime(now, TIMEZONE)), "yyyy-MM-dd")`
   - `weekRange(now: Date = new Date()): { start: string; end: string }` where `end` is `start + 6 days`
   - `formatWeekRange(range): string` → e.g. `"Mon, Oct 27 – Sun, Nov 2, 2026"` (en dash). Use `date-fns` `format` on `ymdToDate` values with `"EEE, MMM d"` for start and `"EEE, MMM d, yyyy"` for end. Note: `ymdToDate` yields UTC midnight; format it with `formatInTimeZone(date, "UTC", ...)` from `date-fns-tz` so the day never shifts.
9. `lib/week.test.ts` (vitest, TDD: write failing tests first, then implement). Cases, each with an explicit `now` as a `Date` constructed from a UTC ISO string:
   - `currentWeekStart(new Date("2026-10-31T10:00:00Z"))` → `"2026-10-26"` (Saturday in Manila)
   - `currentWeekStart(new Date("2026-11-01T15:59:59Z"))` → `"2026-10-26"` (Sunday 23:59:59 Manila)
   - `currentWeekStart(new Date("2026-11-01T16:00:00Z"))` → `"2026-11-02"` (Monday 00:00:00 Manila — boundary crosses in Manila while still Sunday in UTC)
   - `currentWeekStart(new Date("2026-11-02T00:00:00Z"))` → `"2026-11-02"`
   - `todayYmd(new Date("2026-10-31T16:30:00Z"))` → `"2026-11-01"` (already next day in Manila)
   - `weekRange(new Date("2026-10-31T10:00:00Z"))` → `{ start: "2026-10-26", end: "2026-11-01" }`
   - `formatWeekRange({ start: "2026-10-26", end: "2026-11-01" })` → `"Mon, Oct 26 – Sun, Nov 1, 2026"`
   - `dateToYmd(ymdToDate("2026-02-28"))` → `"2026-02-28"` (round-trip)
   - Year-boundary: `currentWeekStart(new Date("2026-01-01T00:00:00Z"))` → `"2025-12-29"`
10. `.dockerignore`: `node_modules`, `.next`, `.git`, `.env`, `.superpowers`, `docs`.
11. Verify: `npm test` passes, `npx tsc --noEmit` passes, `npm run build` succeeds (no DB needed at build).

**Commit(s):** `chore: scaffold Next.js app with Prisma schema and week helpers` (one or two commits as natural).

## Task 2: Task data layer + API routes

**Goal:** `lib/tasks.ts` and the three API route files, matching the API contract in Global Constraints exactly.

**Depends on:** Task 1 (`lib/db.ts`, `lib/week.ts`, Prisma client).

**Steps:**

1. `lib/tasks.ts`:
   - `type TaskDto` per Global Constraints; `toDto(task: Task): TaskDto` converting `dueDate`/`weekOf` with `dateToYmd` (null-safe) and timestamps with `toISOString()`.
   - `weekOfFor(status: Status, now?: Date): Date | null` → `null` for `BACKLOG`, else `ymdToDate(currentWeekStart(now))`.
   - `listBoard(now?: Date): Promise<{ week: { start; end }; tasks: TaskDto[] }>` using the Board query from Global Constraints (`where: { archived: false, OR: [{ status: "BACKLOG" }, { weekOf: ymdToDate(week.start) }] }`, `orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]`).
   - `createTask(input)`, `updateTask(id, input)`, `deleteTask(id)`. `updateTask`/`deleteTask` return `null` when the row does not exist (catch Prisma `P2025`, or `findUnique` first — pick one, keep it simple). Input types are inferred from the zod schemas below.
2. Zod schemas in `lib/tasks.ts` (or a sibling `lib/validation.ts` if `tasks.ts` grows past ~120 lines):
   - `ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`
   - `createTaskSchema = z.object({ title: z.string().trim().min(1).max(200), note: z.string().max(2000).nullish(), dueDate: ymd.nullish(), status: z.nativeEnum(Status).default("BACKLOG") })`
   - `updateTaskSchema = createTaskSchema.partial()` (title remains min 1 when present; `status` has no default when partial)
3. Routes:
   - `app/api/board/route.ts`: `GET` → `listBoard()`.
   - `app/api/tasks/route.ts`: `POST` → parse with `createTaskSchema.safeParse`; `400 { error }` on failure (use `error.issues[0].message` or a flattened string); `201` with the DTO.
   - `app/api/tasks/[id]/route.ts`: `PATCH` and `DELETE` per contract. `params` is a Promise in Next 15 (`{ params }: { params: Promise<{ id: string }> }`); await it.
   - Mark each route `export const dynamic = "force-dynamic"`.
4. Manual verification against a live DB (record the exact commands and output in the report): start the Postgres container as in Task 1 step 6, `npx prisma migrate deploy`, `npm run dev` in the background, then with `curl`: create a task with default status (expect `weekOf: null`), create one with `status: "THIS_WEEK"` (expect `weekOf` = current Monday), `GET /api/board` shows both and the week range, `PATCH` the first to `IN_PROGRESS` (expect `weekOf` set), `PATCH` back to `BACKLOG` (expect `weekOf: null`), `PATCH` with `{ "title": "" }` → 400, `DELETE` → 204, `DELETE` again → 404. Stop dev server and container.
5. `npx tsc --noEmit` and `npm run build` pass.

**Commit:** `feat: task data layer and REST API`

## Task 3: Rollover, reminders, scheduler, instrumentation

**Goal:** Weekly rollover (cron + startup catch-up) and the optional Telegram reminder, wired through `instrumentation.ts`.

**Depends on:** Tasks 1–2.

**Steps:**

1. `lib/rollover.ts`: `export async function rolloverStaleTasks(now: Date = new Date()): Promise<{ archived: number; returnedToBacklog: number }>` implementing the Rollover rule from Global Constraints with exactly two `prisma.task.updateMany` calls (`weekOf: { lt: ymdToDate(currentWeekStart(now)) }`). Log one line: `console.log(\`[rollover] archived=${a} backlog=${b}\`)`.
2. `lib/reminders.ts`: `export async function sendDueTodayReminder(now: Date = new Date()): Promise<void>`. Reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from `process.env`; returns immediately if either is empty. Queries tasks due today per Global Constraints; returns if none. Message text: first line `Due today (YYYY-MM-DD):`, then one line per task `• <title>`. POSTs to the Telegram API; on non-2xx or thrown error, `console.error("[reminders] ...")` and return.
3. `lib/scheduler.ts`: `export async function startScheduler(): Promise<void>`. Guard with `globalThis.__schedulerStarted` (declare the global type). Steps: `await rolloverStaleTasks()` wrapped in try/catch with `console.error`; `cron.schedule("0 0 * * 1", () => void rolloverStaleTasks().catch(console.error), { timezone: TIMEZONE })`; if both Telegram vars are set, `cron.schedule("0 9 * * *", () => void sendDueTodayReminder().catch(console.error), { timezone: TIMEZONE })` and `console.log("[scheduler] telegram reminders enabled")`, else `console.log("[scheduler] telegram reminders disabled")`.
4. `instrumentation.ts` at the project root per Global Constraints.
5. Manual verification (record commands and output in the report): with the Postgres container up and migrated, use a short `npx tsx`-free approach — a one-off Node script via `node --input-type=module -e` or a temporary `scripts/` file you delete before committing — or simply `curl` + `psql` via `docker exec`: insert three rows directly with SQL (`status='DONE', weekOf='2026-10-19'`, `status='IN_PROGRESS', weekOf='2026-10-19'`, `status='THIS_WEEK', weekOf=<current Monday>`), start `npm run dev`, hit `GET /api/board` once to trigger server start, then query the table: the DONE row is `archived=true`, the IN_PROGRESS row is `status='BACKLOG', weekOf=NULL`, the current-week row is unchanged. Confirm the dev log shows `[rollover] archived=1 backlog=1` and `[scheduler] telegram reminders disabled`. Also verify `sendDueTodayReminder` with env vars unset returns without logging an error.
6. `npx tsc --noEmit`, `npm test`, `npm run build` pass.

**Commit:** `feat: weekly rollover and optional Telegram reminders`

## Task 4: Board UI with dnd-kit

**Goal:** The single-page kanban: header with week range, four columns, draggable cards, create/edit/delete dialog with a status select.

**Depends on:** Task 2 (API contract).

**Steps:**

1. `components/Board.tsx` (`"use client"`): on mount, `fetch("/api/board")`; hold `{ week, tasks }` in state; `reload()` after every mutation. Render header: `<h1>Weekly Tracker</h1>` and `<p>` with `formatWeekRange(week)` (import from `@/lib/week` — it is pure and safe on the client). A `+ New task` button opens `TaskDialog` in create mode (default status `THIS_WEEK`). `DndContext` with `PointerSensor` (`activationConstraint: { distance: 5 }`) and `onDragEnd`: if dropped over a column whose id differs from the task's status, `PATCH /api/tasks/:id { status }` then `reload()`. Group tasks by status into the four columns in this order with these labels: `BACKLOG` → "Backlog", `THIS_WEEK` → "This Week", `IN_PROGRESS` → "In Progress", `DONE` → "Done". Show a column count in each header.
2. `components/Column.tsx`: `useDroppable({ id: status })`; highlight when `isOver`. Empty state text `No tasks`.
3. `components/TaskCard.tsx`: `useDraggable({ id: task.id })`; apply `CSS.Translate.toString(transform)` from `@dnd-kit/utilities`. Shows title, due date (if any) as `"Due Nov 2"` using `formatInTimeZone(ymdToDate(dueDate), "UTC", "MMM d")`, with a red tint when `dueDate < todayYmd()` and status is not `DONE`; note shown as a one-line truncated preview. Clicking the card (not dragging) opens the dialog in edit mode.
4. `components/TaskDialog.tsx`: a native `<dialog>` element. Fields: title (`required`, `maxLength 200`), due date (`<input type="date">`), note (`<textarea>`), status (`<select>` with the four statuses). Buttons: Save, Cancel, and Delete (edit mode only; `confirm()`-free — just delete and close). Submit → `POST /api/tasks` or `PATCH /api/tasks/:id` with only the form fields; empty due date → `null`; empty note → `null`. On 4xx show the server `error` string under the form.
5. `app/page.tsx` renders `<Board />`. `app/globals.css`: clean, fast, readable. Light theme, system font, a `.board` CSS grid of 4 equal columns (stacking to 1 column under 900px), cards with a 1px border and 6px radius, column background subtly different from page, `.is-over` highlight, `.overdue` red tint, dialog styles. Keep it under ~150 lines. No animations beyond dnd-kit's transform.
6. `useId`/keys: card key is `task.id`; column id is the status string.
7. Verification (record in the report): with DB container up, migrated, `npm run dev` running, exercise in a real browser (use the gstack `/browse` skill if available in your environment, otherwise Playwright/Chromium via `npx playwright` is NOT allowed — it adds a dependency; if no browser automation is available, verify with `curl` that the page renders and state the UI gap as a concern). Check: create a task, it appears in the chosen column; drag it to another column, it moves and survives a reload; edit title/note/due; delete; header shows the week range; `npm run build` succeeds.

**Commit:** `feat: kanban board UI with drag-and-drop`

## Task 5: Docker, compose, env example, README; end-to-end boot + persistence check

**Goal:** `docker compose up` boots the full stack from scratch, applies migrations, serves the board on port 3000, and keeps data across `down`/`up`.

**Depends on:** Tasks 1–4.

**Steps:**

1. `Dockerfile`, `docker-entrypoint.sh` (`#!/bin/sh`, `set -e`, `npx prisma migrate deploy`, `exec npm run start`; `chmod +x`, committed executable), `docker-compose.yml`, `.env.example` — all per Global Constraints verbatim.
2. `README.md`: title, one-paragraph description, **Run** section with exactly: copy `.env.example` to `.env` (optional, only for Telegram), then `docker compose up`, open `http://localhost:3000`. **Data** section: named volume `pgdata`, survives `docker compose down`; `docker compose down -v` deletes it. **Telegram reminders (optional)** section: the two env vars, daily 09:00 Asia/Manila. **How the week works** section: ISO week Monday–Sunday in Asia/Manila; rollover Monday 00:00 plus startup catch-up; Done tasks archived. **Local development** section: `npm install`, start Postgres (compose `db` only: `docker compose up db`), `npx prisma migrate dev`, `npm run dev`, `npm test`. Under 80 lines.
3. End-to-end verification (record every command and the relevant output in the report):
   - `docker compose down -v` (clean slate; ensure no other container is holding ports 3000/5433), then `docker compose up -d --build`; wait until `curl -sf localhost:3000/api/board` returns JSON with an empty `tasks` array.
   - `docker compose logs app` shows `prisma migrate deploy` applying `init` and the `[rollover]` and `[scheduler]` lines.
   - `curl -X POST localhost:3000/api/tasks -H 'content-type: application/json' -d '{"title":"persist me","status":"THIS_WEEK"}'`.
   - `docker compose down` (no `-v`), `docker compose up -d`, wait, `GET /api/board` still contains `persist me`.
   - Confirm the image contains no `.env` (`docker compose run --rm app ls -a` shows none).
   - `docker compose down -v` to clean up at the end.
4. Confirm `.gitignore` already covers `.env`, `node_modules`, `.next` (it does; do not duplicate).

**Commit:** `feat: docker compose deployment and README`

## Task 6: `rolledBackAt` field (data for the Monday cue)

**Goal:** The board can tell which Backlog tasks the weekly rollover just returned, exactly, without heuristics.

**Depends on:** Tasks 1–3.

**Steps:**

1. `prisma/schema.prisma`: add `rolledBackAt DateTime? @db.Date` to `Task` (the Monday of the week the task was rolled back into). Generate a migration named `rolled_back_at` against the throwaway Postgres (same procedure as Task 1 step 6: container `wt-pg`, host port 5433, `npx prisma migrate dev --name rolled_back_at`, then `docker rm -f wt-pg`). Commit `prisma/migrations/**`.
2. `lib/rollover.ts`: the non-DONE `updateMany` also sets `rolledBackAt: ymdToDate(currentWeekStart(now))`. The DONE/archive call is unchanged.
3. `lib/tasks.ts`: `TaskDto` gains `rolledBackAt: string | null` (via `dateToYmd`). `updateTask`: whenever `status` is present in the input, also set `rolledBackAt: null`. `createTask` leaves it null. Board ordering: Backlog cards with `rolledBackAt` equal to the current week start sort first; implement as `orderBy: [{ rolledBackAt: { sort: "desc", nulls: "last" } }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]`.
4. Manual verification against the live DB (record commands and output): insert a row `status='IN_PROGRESS', weekOf='2026-10-19'`, start `npm run dev`, hit `/api/board`: the row is now `BACKLOG`, `weekOf` null, `rolledBackAt` = current Monday, and appears first in the response. `PATCH` it to `THIS_WEEK`: `rolledBackAt` is null. `PATCH` only `{ "title": "x" }` on a rolled-back row: `rolledBackAt` unchanged.
5. `npx tsc --noEmit`, `npm test`, `npm run build` pass.

**Commit:** `feat: track rolledBackAt for the Monday rollover cue`

## Task 7: UI design pass

**Goal:** Apply every design decision from the 2026-10-31 design review (D3–D20 below) to the board. The spec's feature set is unchanged; this task changes how the existing features look and respond.

**Depends on:** Tasks 4 and 6.

**Decisions to implement (each is binding):**

- **D3 Header:** the h1 is `formatWeekRange(week)` at 15px/500. App name appears only in `<title>`. No header button. When `N > 0` Backlog cards have `rolledBackAt === week.start`, a second muted line reads `N back from last week` (singular `1 back from last week`).
- **D4 Columns:** desktop grid `0.8fr 1fr 1fr 0.8fr`, gap 16px. 600–900px: two-by-two grid in order This week, In progress, Backlog, Done. Under 600px: single column in order In progress, This week, Done, Backlog, page padding 16px. Use CSS `order` so the DOM order stays Backlog, This week, In progress, Done.
- **D5 Cards:** title (14px/500) and, when present, a due label on the next row at 12px. No note preview; a note is indicated by a muted `·` glyph after the due label (or alone when no due date) with `aria-label="has note"`. Done cards at 60% text opacity with the due label hidden.
- **D6 Board states:** loading = four column shells with two placeholder bars each (`--border` at 50% alpha, 12px tall), no text. Empty column = muted `nothing here`. Fetch failure = one line under the header, `couldn't load the board · retry`, where `retry` is a text button; `aria-live="polite"`.
- **D7 Optimistic:** `useBoard.ts` holds `tasks` in state. Drop → move the card locally, `PATCH { status }`; on failure restore the previous array and show `couldn't save · retry` under the header (retry re-sends the same PATCH). Quick-add → insert a temporary card (id `tmp-<uuid>`, 60% opacity) and replace it with the server DTO; on failure remove it and show the error line. Dialog Save/Delete disabled while in flight with labels `saving…` / `deleting…`. No full reload after mutations; `reload()` exists only for the error-line retry and D11.
- **D8 Delete:** in the dialog, `Delete` becomes `Delete? yes` on first click and reverts after 3s if not clicked again; second click deletes and closes.
- **D9 Signals:** due label text: `due Thu` when the due date falls inside the current week and is after today, `due Nov 12` when outside the week, `today` (accent) when equal to `todayYmd()`, `overdue · Oct 29` (accent) when before today. Never color alone. Hover/drag/drop borders per the token block; no shadows, no fills.
- **D10 Monday cue:** rolled-back cards (`rolledBackAt === week.start`) render first in Backlog with a muted `last week` tag after the title row. Server ordering from Task 6 already puts them first; the client does not re-sort.
- **D11 Stale tab:** `useBoard.ts` refetches on `visibilitychange` (visible) and `focus`, and checks `todayYmd()` every 60s; when the day changes, re-render (and refetch if the week changed). `todayYmd()` is computed per render, not memoized at mount.
- **D12 Type:** `app/layout.tsx` loads Geist Sans with `next/font/google` (`{ subsets: ["latin"], display: "swap", variable: "--font-sans" }`) and sets it on `<html>`. `globals.css` uses `var(--font-sans), system-ui, sans-serif`.
- **D13 Quick-add:** each column ends with a `QuickAdd` row: a muted `+ add` button that turns into a single text input (placeholder `title`), Enter saves `POST /api/tasks { title, status: <column> }`, Esc or blur-with-empty cancels. The dialog is edit-only; `TaskDialog` no longer has a create mode.
- **D14 Tokens:** implement the Global Constraints token block verbatim. `globals.css` is the only stylesheet.
- **D15 Keyboard:** add `KeyboardSensor` with `sortableKeyboardCoordinates` replaced by a custom coordinate getter that moves the active card to the adjacent column on ArrowLeft/ArrowRight (Space picks up and drops, Esc cancels). The card title is a `<button type="button">` that opens the dialog on click/Enter/Space; the card root carries the drag listeners. `:focus-visible` ring per tokens on every focusable.
- **D16 Touch:** add `TouchSensor` with `activationConstraint: { delay: 250, tolerance: 8 }`; remove `touch-action: none`. Buttons, the quick-add row and the card title button have `min-height: 44px` on pointer-coarse devices (`@media (pointer: coarse)`).
- **D17 Screen readers:** `DndContext` `accessibility.announcements` produce `Picked up "<title>".`, `"<title>" is over <Column label>.`, `"<title>" moved to <Column label>.`, `Move cancelled.` Each column is `<section aria-labelledby="<id of its h2>">`; the page body is `<main>`.
- **D18 Titles:** card title `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden` with the full title in `title=`. The dialog shows the full title.
- **D19 Columns scroll:** `.board` is `height: calc(100dvh - header height)`; each column is a flex column with a sticky label row, a scrolling card list (`overflow-y: auto`, `flex: 1`), and the quick-add row pinned at the bottom. The droppable node is the whole column so empty space accepts drops. Under 600px the board reverts to page scroll (`height: auto`, column lists not scrollable).
- **D20 Due dates:** any date allowed; labels per D9.

**Steps:**

1. Implement the above across `components/*`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`. Keep `Board.tsx` thin: state in `useBoard.ts`, rendering in components. `globals.css` may reach ~220 lines; keep it grouped by tokens → layout → column → card → quick-add → dialog → states.
2. Remove dead code from Task 4: header button, create mode in the dialog, `.overdue` tint, `.is-over` fill, drag shadow.
3. Verification (record in the report): with DB container up and `npm run dev` running, use the gstack `browse` skill if available (it was available to Task 4). Check in a 1440px viewport, dark: header shows only the week range; quick-add via Enter creates a card in that column instantly; drag moves a card with no snap-back; keyboard: Tab to a card, Enter opens dialog, Esc closes; Space + ArrowRight + Space moves it; two-step delete; a card with a past due date shows `overdue · <date>` in accent; Done card muted; resize to 800px shows the 2×2 grid, 500px the single column with In progress first. Insert a row with `rolledBackAt` = current Monday via SQL and confirm the header line `1 back from last week` and the `last week` tag. Confirm `prefers-reduced-motion` disables transitions (emulate in the browser if the skill supports it, otherwise state as unverified). `npx tsc --noEmit`, `npm test`, `npm run build` pass.

**Commit(s):** `feat: board design pass (tokens, states, quick-add, optimistic moves, a11y)`; split into two commits (styles/tokens, then behaviour) if natural.

## Design Review: Required Outputs (2026-10-31, /plan-design-review + /impeccable)

### Interaction state table

```
FEATURE          | LOADING                    | EMPTY                | ERROR                              | SUCCESS                         | PARTIAL
-----------------|----------------------------|----------------------|------------------------------------|---------------------------------|------------------------------
Board load       | 4 column shells, 2 bars    | columns: nothing here| "couldn't load the board · retry"  | columns populated, header range | n/a
Drag to column   | card moves instantly       | n/a                  | card returns; "couldn't save · retry" | card stays                   | n/a
Quick-add        | temp card at 60% opacity   | input with "title"   | temp card removed; error line      | real card replaces temp         | n/a
Edit dialog save | Save disabled, "saving…"   | n/a                  | server error string under form     | dialog closes, card updates     | n/a
Delete           | "deleting…"                | n/a                  | error string under form            | dialog closes, card gone        | first click: "Delete? yes" 3s
Monday cue       | n/a                        | no line              | n/a                                | "N back from last week" + tags  | n/a
```

### Journey storyboard

```
STEP | USER DOES                          | USER FEELS            | PLAN SPECIFIES?
-----|------------------------------------|-----------------------|-----------------------------------------------
1    | Opens board Monday evening         | oriented              | D3 week range h1; D10 "N back from last week"
2    | Triages rolled-back cards          | in control            | D10 tags + first in Backlog; drag/keyboard moves (D7, D15)
3    | Captures new items quickly         | unobstructed          | D13 quick-add, Enter to save
4    | Mid-week: moves work, checks due   | calm, informed        | D9 due labels; D7 instant moves; D19 week columns always visible
5    | Thursday: something overdue        | nudged, not nagged    | D9 "overdue · Oct 29" in accent, text not color alone
6    | Sunday night, tab left open        | trusts the board      | D11 refetch on focus / day change
7    | Months in                          | board disappears      | D14 tokens, no decoration; Done archived by rollover
```

### NOT in scope
- Undo after delete (two-step confirm chosen instead; undo needs a pending-delete state and timer).
- Reordering within a column (spec excludes it).
- Light theme / theme toggle (scene is evening; a toggle is a settings surface the spec forbids).
- Filters, search, tags, counts beyond the column header.
- Visual mockups (gstack designer needs an OpenAI API key; none configured) and Codex outside voice (ChatGPT-account Codex rejects the configured models).

### What already exists
- `lib/week.ts` helpers (client-safe) for all date labels.
- dnd-kit `DndContext`/`useDraggable`/`useDroppable` wiring from Task 4; sensors and announcements extend it.
- Native `<dialog>` from Task 4 stays as the edit surface.
- API contract unchanged except the additive `rolledBackAt` DTO field (Task 6).

### TODOS.md updates
None proposed: every finding was accepted into Tasks 6–7.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — data — Add `rolledBackAt`, set in rollover, clear on status change, expose in DTO, order Backlog by it
  - Surfaced by: Pass 3 — D10/D10b Monday cue needs an exact signal
  - Files: prisma/schema.prisma, prisma/migrations/*, lib/rollover.ts, lib/tasks.ts
  - Verify: Task 6 step 4 curl sequence
- [ ] **T2 (P1, human: ~1d / CC: ~30min)** — styles — Implement the token block (dark palette, Geist, spacing, radius, motion, browser surfaces, focus ring)
  - Surfaced by: Pass 5 — D14; Pass 4 — D12
  - Files: app/globals.css, app/layout.tsx
  - Verify: computed styles in browser; contrast of --muted and --accent on --card ≥ 4.5:1
- [ ] **T3 (P1, human: ~1d / CC: ~30min)** — Board/useBoard — Optimistic moves with rollback, loading skeleton, error line with retry, refetch on focus/day change
  - Surfaced by: Pass 2 — D6, D7; Pass 3 — D11
  - Files: components/useBoard.ts, components/Board.tsx
  - Verify: Task 7 step 3 browser checks
- [ ] **T4 (P1, human: ~4h / CC: ~15min)** — Column/QuickAdd — Inline quick-add per column; remove header button and dialog create mode
  - Surfaced by: Pass 4 — D13 modal-by-default
  - Files: components/QuickAdd.tsx, components/Column.tsx, components/TaskDialog.tsx
  - Verify: Enter creates in the right column; Esc cancels
- [ ] **T5 (P1, human: ~4h / CC: ~15min)** — TaskCard/TaskDialog — Header hierarchy, card density, due labels, Done muting, 2-line clamp, two-step delete, in-flight disabling
  - Surfaced by: Pass 1 — D3, D5; Pass 2 — D8, D9; Pass 7 — D18, D20
  - Files: components/Board.tsx, components/TaskCard.tsx, components/TaskDialog.tsx
  - Verify: Task 7 step 3 browser checks
- [ ] **T6 (P1, human: ~1d / CC: ~30min)** — a11y — KeyboardSensor with column-step coordinates, title button, TouchSensor, 44px targets, announcements, landmarks
  - Surfaced by: Pass 6 — D15, D16, D17
  - Files: components/Board.tsx, components/TaskCard.tsx, components/Column.tsx, app/globals.css
  - Verify: keyboard move sequence; VoiceOver/NVDA spot check or announcement strings in DOM live region
- [ ] **T7 (P2, human: ~4h / CC: ~15min)** — layout — Column weights, 2×2 tablet grid, <600 order, viewport-height board with internal column scroll, full-column drop zone
  - Surfaced by: Pass 1 — D4; Pass 6 — D16; Pass 7 — D19
  - Files: app/globals.css, components/Column.tsx
  - Verify: 1440 / 800 / 500px viewports

_No new tasks from Pass 4 beyond T2/T4 (palette and modal)._

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | no DESIGN.md (now seeded); UI scope Task 4  |
  | Step 0               | 4/10; all 7 passes                          |
  | Pass 1  (Info Arch)  | 4/10 → 9/10 after fixes                     |
  | Pass 2  (States)     | 3/10 → 9/10 after fixes                     |
  | Pass 3  (Journey)    | 3/10 → 9/10 after fixes                     |
  | Pass 4  (AI Slop)    | 5/10 → 8/10 after fixes (no mockups to grade)|
  | Pass 5  (Design Sys) | 2/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 2/10 → 9/10 after fixes                     |
  | Pass 7  (Decisions)  | 3 resolved (D18–D20), 0 deferred            |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated, 0 approved (designer no API key)|
  | Decisions made       | 19 added to plan (D3–D20 incl. D10b)        |
  | Decisions deferred   | 0                                           |
  | Overall design score | 2/10 → 8/10                                 |
  +====================================================================+
```

Pass 4 stays at 8 because no rendered surface or mockup could be graded against the slop blacklist; `/design-review` after Task 7 closes that gap.

### Unresolved Decisions
None.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex (design phase) via `/plan-design-review` | Independent 2nd opinion | 1 | unavailable | model_not_found on ChatGPT account (gpt-6-astra, gpt-5.5) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score: 2/10 → 8/10, 19 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** provider codex, phase design, status unavailable (two attempts, `model_not_found`); native Claude subagent review completed (20 findings, all folded into D3–D20). Missing outside coverage is recorded, not inferred clean.
- **VERDICT:** DESIGN CLEARED — eng review required.

NO UNRESOLVED DECISIONS
