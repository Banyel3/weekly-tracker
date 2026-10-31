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
- **Docker:** `docker-compose.yml` services `db` (image `postgres:16`, named volume `pgdata:/var/lib/postgresql/data`, `POSTGRES_USER=tracker`, `POSTGRES_PASSWORD=tracker`, `POSTGRES_DB=tracker`, healthcheck `pg_isready -U tracker -d tracker`, interval 5s, timeout 3s, retries 10, port `5432:5432`) and `app` (build `.`, port `3000:3000`, `depends_on: db: condition: service_healthy`, environment `DATABASE_URL=postgresql://tracker:tracker@db:5432/tracker`, `TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}`, `TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-}`, `restart: unless-stopped`). Top-level `volumes: pgdata:`.
- **Dockerfile:** base `node:22-bookworm-slim`, `apt-get install -y openssl`, two stages (`build`: `npm ci`, `npx prisma generate`, `npm run build`; `runner`: copies `node_modules`, `.next`, `public`, `prisma`, `package.json`, `next.config.ts`, `docker-entrypoint.sh`). `ENTRYPOINT ["./docker-entrypoint.sh"]`; the script runs `npx prisma migrate deploy` then `exec npm run start`. `NODE_ENV=production`.
- **`.env.example`:**
  ```
  DATABASE_URL=postgresql://tracker:tracker@localhost:5432/tracker
  TELEGRAM_BOT_TOKEN=
  TELEGRAM_CHAT_ID=
  ```
- **Commits:** Conventional Commits. Every commit message ends with the trailer line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Tests:** `vitest` unit tests for `lib/week.ts` only (pure date math). Everything that touches the database is verified manually against the compose `db` service, with the commands and output recorded in the task report. `npm test` runs `vitest run`.
- **Code style:** small files, one responsibility each. No comments that restate the code. No dead code, no TODOs.

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
  Board.tsx             client: fetch /api/board, DndContext, 4 columns, dialog state
  Column.tsx            client: useDroppable
  TaskCard.tsx          client: useDraggable
  TaskDialog.tsx        client: create/edit form with status select + delete
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

Tasks run sequentially on branch `feat/weekly-kanban`. Final whole-branch review: final-reviewer (opus).

## Task 1: Scaffold + Prisma schema/migration + `lib/week.ts` with tests

**Goal:** A Next.js 15 TypeScript project that builds, with the Prisma schema, the initial migration, the Prisma client singleton, and the pure week/date helpers under unit test.

**Steps:**

1. Create `package.json` by hand (do not use interactive `create-next-app`). Name `weekly-tracker`, `"private": true`. Scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`, `"test": "vitest run"`, `"postinstall": "prisma generate"`. Install the dependencies listed in Global Constraints with `npm install` (runtime) and `npm install -D` (dev). Commit the resulting `package-lock.json`.
2. `tsconfig.json`: Next.js defaults (`strict: true`, `moduleResolution: "bundler"`, `jsx: "preserve"`, `paths: { "@/*": ["./*"] }`, include `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, exclude `node_modules`).
3. `next.config.ts` per Global Constraints.
4. `app/layout.tsx` (html lang `en`, body, imports `./globals.css`, metadata title `Weekly Tracker`) and a placeholder `app/page.tsx` that renders `<main>Weekly Tracker</main>` (Task 4 replaces it). `app/globals.css` with a minimal reset only (box-sizing, margin 0, system font stack); Task 4 adds the real styles.
5. `prisma/schema.prisma`: `generator client { provider = "prisma-client-js" }`, `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`, the `Status` enum and `Task` model from Global Constraints verbatim.
6. Create `.env` locally (git-ignored) with `DATABASE_URL=postgresql://tracker:tracker@localhost:5432/tracker`. Start a throwaway Postgres for migration generation: `docker run -d --name wt-pg -e POSTGRES_USER=tracker -e POSTGRES_PASSWORD=tracker -e POSTGRES_DB=tracker -p 5432:5432 postgres:16`, wait for `docker exec wt-pg pg_isready -U tracker`, then `npx prisma migrate dev --name init`. Commit `prisma/migrations/**`. Stop and remove the container when done (`docker rm -f wt-pg`). If port 5432 is taken, use another host port and adjust `.env` for this step only.
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
   - `docker compose down -v` (clean slate; ensure no other container is holding ports 3000/5432), then `docker compose up -d --build`; wait until `curl -sf localhost:3000/api/board` returns JSON with an empty `tasks` array.
   - `docker compose logs app` shows `prisma migrate deploy` applying `init` and the `[rollover]` and `[scheduler]` lines.
   - `curl -X POST localhost:3000/api/tasks -H 'content-type: application/json' -d '{"title":"persist me","status":"THIS_WEEK"}'`.
   - `docker compose down` (no `-v`), `docker compose up -d`, wait, `GET /api/board` still contains `persist me`.
   - Confirm the image contains no `.env` (`docker compose run --rm app ls -a` shows none).
   - `docker compose down -v` to clean up at the end.
4. Confirm `.gitignore` already covers `.env`, `node_modules`, `.next` (it does; do not duplicate).

**Commit:** `feat: docker compose deployment and README`
