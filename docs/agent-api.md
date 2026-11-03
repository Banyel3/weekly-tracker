# Agent API

The agent API lets an AI agent (Yumi, the Telegram bot, later powered by Claude) read and change the tracker. It is the same single-user tracker: the agent acts as the owner, and every change it makes is recorded in the task history like a change made on the board.

There are two entry points over one operation layer (`lib/agent/ops.ts`):

- **Tool use.** `GET /api/agent/tools` returns twelve tool definitions in the Anthropic Messages API format (`name`, `description`, `input_schema`), ready to pass as the `tools` parameter. `POST /api/agent/run` runs one tool by name.
- **REST shortcuts.** Plain routes such as `GET /api/agent/today` or `POST /api/agent/tasks/{id}/done` for scripts and simple bots. They call the same tools and return the same results.

## Auth

Set `AGENT_API_TOKEN` in `.env` (and it is passed into the container by `docker-compose.yml`):

```sh
openssl rand -hex 32   # paste the output after AGENT_API_TOKEN=
```

Every route under `/api/agent/` requires `Authorization: Bearer <token>`.

| Situation | Status | Body |
|---|---|---|
| `AGENT_API_TOKEN` unset or empty | 503 | `{ "error": "agent api disabled: set AGENT_API_TOKEN" }` |
| Header missing, not `Bearer`, or wrong token | 401 | `{ "error": "unauthorized" }` |

The token is compared in constant time. The board's own routes (`/api/tasks`, `/api/board`, …) stay unauthenticated and unchanged; keep the app on localhost or Tailscale as before.

## Conventions

- **Dates** are `YYYY-MM-DD` in Asia/Manila. Inputs also accept `today` and `tomorrow`. Impossible days such as `2026-02-30` are rejected.
- **Status** inputs are `backlog`, `this_week`, `in_progress`, `done`, case-insensitive (`In Progress` and `in-progress` work). Outputs use the board's enum (`BACKLOG`, `THIS_WEEK`, `IN_PROGRESS`, `DONE`).
- **Priority** inputs are `none`, `high`, `urgent`; outputs are `NONE`, `HIGH`, `URGENT`.
- **Projects** are referred to by name, case-insensitive. `create_task` and `update_task` create a missing project with the next unused colour; `list_tasks` never creates one.
- **Unknown keys are errors.** A misspelled field (`dueDate` instead of `due`) returns 400 rather than being ignored.
- **Outputs** reuse the board's shapes: a task is a `TaskDto`, a project is `{ id, name, color }`.

A `TaskDto` looks like this:

```json
{
  "id": "cmh3k2t0x0001",
  "title": "Ship v2",
  "note": "after QA",
  "dueDate": "2026-11-06",
  "status": "THIS_WEEK",
  "weekOf": "2026-11-02",
  "rolledBackAt": null,
  "projectId": "cmh3k1z9q0000",
  "priority": "HIGH",
  "checklist": [{ "id": "4f0c…", "text": "QA", "done": false }],
  "rolloverCount": 0,
  "completedAt": null,
  "archived": false,
  "createdAt": "2026-11-04T02:10:00.000Z",
  "updatedAt": "2026-11-04T02:10:00.000Z"
}
```

## Errors

| Status | When |
|---|---|
| 400 | Invalid JSON, invalid tool input, or an input the tool cannot act on (for example moving an archived task) |
| 401 / 503 | Auth, see above |
| 404 | Unknown tool, unknown task id, unknown project name in `list_tasks`, unknown REST action |
| 413 | Request body over 64 kB |

Errors are always `{ "error": string }`; `/api/agent/run` adds `"ok": false`. Validation problems are joined into one readable line, each prefixed with its field:

```json
{ "ok": false, "error": "title: Required; due: must be YYYY-MM-DD, today or tomorrow" }
```

## Running a tool

```http
POST /api/agent/run
{ "name": "move_task", "input": { "id": "cmh3k2t0x0001", "status": "done" } }
```

Success is `200 { "ok": true, "result": … }`. `input` may be omitted for tools without inputs.

## The tools

### 1. `get_today`

Today's briefing. Input: none.

```json
{
  "date": "2026-11-04", "weekday": "Wednesday", "dayIndex": 3,
  "week": { "start": "2026-11-02", "end": "2026-11-08" },
  "digest": "Good morning · Wed Nov 4 · day 3 of 7\n\nOverdue\n• Pay rent — due Mon, 2d late\n\n…",
  "overdue": [TaskDto], "dueToday": [TaskDto], "dueTomorrow": [TaskDto], "laterThisWeek": [TaskDto],
  "inProgress": 2, "wipLimit": 3, "openThisWeek": 7, "carried": 1
}
```

`digest` is the same text as the 09:00 Telegram digest; the four lists hold the tasks it names (open tasks in any column, sorted by due date, then priority, then age). `dayIndex` counts Monday as 1.

### 2. `get_board`

The board for the current week. Input: none. Result: `{ week, today, projects, tasks, counts: { live, archived, nudges }, carriedIds }`: every Backlog task plus this week's This week, In progress and Done tasks, sorted per column like the board.

### 3. `list_tasks`

Search with filters. Every field is optional.

```json
{ "status": ["this_week", "in_progress"], "project": "Work", "due_from": "today", "due_to": "2026-11-30",
  "query": "brief", "archived": false, "limit": 20 }
```

`query` matches the title or note (case-insensitive). `archived: true` searches archived tasks instead of live ones. `limit` is 1–100, default 50; when more tasks match, you get the soonest-due ones (undated tasks last, then oldest first). Result: `{ "tasks": [TaskDto] }`, grouped by column and sorted like the board. Errors: `limit` over 100 (400), a bad status name (400), `due_from` after `due_to` (400), an unknown project (404).

### 4. `get_task`

```json
{ "id": "cmh3k2t0x0001" }
```

Result: `{ "task": TaskDto, "events": [{ "type": "PLANNED", "at": "2026-11-04T02:10:00.000Z", "from": "BACKLOG", "to": "THIS_WEEK" }] }`, the latest 20 history events, newest first. Unknown id: 404.

### 5. `create_task`

```json
{ "title": "Ship v2", "note": "after QA", "due": "2026-11-06", "priority": "high",
  "status": "this_week", "project": "Work", "checklist": ["QA", "Deploy"] }
```

Only `title` is required. `status` defaults to `backlog`; any other column plans the task into the current week, and `done` records the completion time. `checklist` takes up to 20 item texts. Result: `{ "task": TaskDto }`.

### 6. `update_task`

```json
{ "id": "cmh3k2t0x0001", "title": "Ship v2.1", "due": null, "project": null, "checklist": ["QA", "Deploy", "Announce"] }
```

Only the fields passed change. `null` clears `note`, `due` or `project`. `checklist` replaces the list; items whose text is unchanged keep their ticked state. Change the column with `move_task`. Errors: only `id` passed (400), unknown id (404). Result: `{ "task": TaskDto }`.

### 7. `move_task`

```json
{ "id": "cmh3k2t0x0001", "status": "done" }
```

`this_week`, `in_progress` and `done` plan the task into the current week; `done` sets `completedAt`; `backlog` unplans it. An archived task must be restored first (400 `restore the task before changing its status`). Result: `{ "task": TaskDto }`.

### 8. `snooze_task`

```json
{ "id": "cmh3k2t0x0001", "days": 2 }
{ "id": "cmh3k2t0x0001", "until": "2026-11-10" }
```

With `until`, the due date becomes that day; `until` before today is rejected (400). Otherwise the due date moves `days` ahead (1–60, default 1) from the later of today and the current due date, so a task that was due last Friday and is snoozed by 2 on Wednesday lands on Friday this week. Passing both is a 400. Result: `{ "task": TaskDto }`.

### 9. `delete_task`

```json
{ "id": "cmh3k2t0x0001" }
```

Deletes permanently; the history stays for the weekly stats. Result: `{ "deleted": true }`. Unknown id: 404. To finish a task, prefer `move_task` with `done`.

### 10. `restore_task`

```json
{ "id": "cmh3k2t0x0001", "status": "this_week" }
```

Brings an archived task back, into `backlog` by default or into `status`. A live task is a 400 (`task is not archived`). Result: `{ "task": TaskDto }`.

### 11. `get_review`

The weekly review. Input: none. Result: `{ "review": ReviewDto, "summary": "Week of Nov 2: finished 3 of 8 · 2 in progress · 1 overdue\n…" }`. `review` is the same object the `/review` page renders (this week by project, carried tasks, last week, finishes per day, insights); `summary` is the Friday summary text.

### 12. `list_projects`

Input: none. Result: `{ "projects": [{ "id": "cmh3k1z9q0000", "name": "Work", "color": "sky" }] }`, sorted by name.

## REST shortcuts

Same auth, same results as the tool (without the `ok`/`result` envelope), errors as `{ "error": string }`.

| Method and path | Tool | Input |
|---|---|---|
| `GET /api/agent/today` | `get_today` | none |
| `GET /api/agent/board` | `get_board` | none |
| `GET /api/agent/tasks` | `list_tasks` | query params: `status` (comma-separated), `project`, `due_from`, `due_to`, `query`, `archived=true\|false`, `limit` |
| `POST /api/agent/tasks` | `create_task` | JSON body |
| `GET /api/agent/tasks/{id}` | `get_task` | none |
| `PATCH /api/agent/tasks/{id}` | `update_task` | JSON body without `id` (the path id wins) |
| `DELETE /api/agent/tasks/{id}` | `delete_task` | none |
| `POST /api/agent/tasks/{id}/done` | `move_task` to `done` | none |
| `POST /api/agent/tasks/{id}/start` | `move_task` to `in_progress` | none |
| `POST /api/agent/tasks/{id}/plan` | `move_task` to `this_week` | none |
| `POST /api/agent/tasks/{id}/backlog` | `move_task` to `backlog` | none |
| `POST /api/agent/tasks/{id}/snooze` | `snooze_task` | optional body `{ "days" }` or `{ "until" }` |
| `POST /api/agent/tasks/{id}/restore` | `restore_task` | optional body `{ "status" }` |
| `GET /api/agent/review` | `get_review` | none |
| `GET /api/agent/projects` | `list_projects` | none |

Any other action under `/api/agent/tasks/{id}/` is a 404 (`unknown action: …`).

## curl walkthrough

```sh
export TRACKER_URL=http://localhost:3000
export AGENT_API_TOKEN=…   # the value from .env
auth=(-H "Authorization: Bearer $AGENT_API_TOKEN")

# What is on today?
curl -s "${auth[@]}" "$TRACKER_URL/api/agent/today" | jq -r .digest

# Add a task for tomorrow in the Work project (created if missing)
id=$(curl -s "${auth[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Send the invoice","due":"tomorrow","project":"Work","status":"this_week"}' \
  "$TRACKER_URL/api/agent/tasks" | jq -r .task.id)

# Start it, push it two days, then finish it
curl -s "${auth[@]}" -X POST "$TRACKER_URL/api/agent/tasks/$id/start" | jq .task.status
curl -s "${auth[@]}" -H 'Content-Type: application/json' -d '{"days":2}' \
  "$TRACKER_URL/api/agent/tasks/$id/snooze" | jq .task.dueDate
curl -s "${auth[@]}" -X POST "$TRACKER_URL/api/agent/tasks/$id/done" | jq .task.completedAt

# The same move through the tool runner
curl -s "${auth[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"move_task\",\"input\":{\"id\":\"$id\",\"status\":\"in progress\"}}" \
  "$TRACKER_URL/api/agent/run"

# Open This week and In progress tasks
curl -s "${auth[@]}" "$TRACKER_URL/api/agent/tasks?status=this_week,in_progress" | jq -r '.tasks[].title'
```

## A Claude loop

`docs/examples/yumi-loop.mjs` (not part of the build) shows the whole loop in about forty lines: it fetches `/api/agent/tools`, sends the user's message to the Messages API with model `claude-sonnet-5-5` and `tool_choice: auto`, runs every `tool_use` block through `/api/agent/run`, sends all the `tool_result` blocks back in one user message (failed calls with `is_error: true`), and repeats until Claude answers in text. It opts into server-side refusal fallbacks (`fallbacks: "default"`) and stops on a `refusal` stop reason.

```sh
npm i @anthropic-ai/sdk   # peer dependency, not in package.json
ANTHROPIC_API_KEY=… TRACKER_URL=http://localhost:3000 AGENT_API_TOKEN=… \
  node docs/examples/yumi-loop.mjs "Snooze the invoice to Friday and tell me what's overdue"
```

## Limits

- Request bodies over 64 kB are rejected with 413.
- `list_tasks` returns at most 100 tasks; every list query is bounded.
- There is no rate limiting beyond the body cap; the token is the only gate.

## Later

Out of scope for now:

- **Attributing events to the bot.** History events do not record who made a change; a `TaskEvent.via` column would let the board show "by Yumi".
- **The Telegram command handler and the Claude loop itself.** Yumi still only sends the digest and the Friday summary; replying to it (Done / Snooze buttons, free text through Claude) is the Phase 3 "Telegram digest with Done/Snooze" work.
- **Future-tasks tools.** Nothing here plans tasks into weeks after the current one.
- **Rate limiting** beyond the 64 kB body cap.
