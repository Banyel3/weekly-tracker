# Morning digest — Telegram 09:00 reminder becomes a daily digest

Date: 2026-11-04. Branch `feat/morning-digest` off `main` 3c3caea. Owner decision (2026-11-04): full morning digest, and a short note on quiet days.

## Global Constraints

- Timezone `Asia/Manila` via `TIMEZONE` from `lib/week.ts`; all day boundaries use `todayYmd`, `shiftYmd`, `weekRange`, `currentWeekStart`.
- Schedule unchanged: `0 9 * * *` in `lib/scheduler.ts`; catch-up rule in `lib/catchUp.ts` unchanged (`lastSentOn:reminder` marker = today after a successful send; keep `REMINDER_SENT_KEY`).
- Telegram transport unchanged: `sendTelegram(text, tag)` in `lib/reminders.ts` (10 s timeout, plain text, no parse_mode, no buttons). Message ≤ 4096 chars: each section lists at most 10 tasks, then `… and N more`.
- Candidate tasks: `archived = false`, `status != DONE`. Due sections use `dueDate` regardless of column (Backlog included). "Open this week" = non-Done tasks with `weekOf = current week start`. "In progress" = `status = IN_PROGRESS` count against `WIP_LIMIT` from `lib/constants.ts`. "Carried from last week" = `carriedTaskIds(events, weekStart)` from `lib/carried.ts` over this week's `ROLLED_BACK/DELETED/RESTORED` events (same source as the board sidebar count in `lib/tasks.ts` `listBoard`).
- Exact format (blank line between sections; omit empty sections; `·` separators; project name appended as ` · <project>` when the task has one; weekday abbreviations `Mon…Sun`):

```
Good morning · Wed Nov 4 · day 3 of 7

Overdue
• <title> · <project> — due Mon, 2d late

Due today
• <title> · <project>

Due tomorrow
• <title>

Later this week
• Thu: <title>
• Sat: <title>

In progress 1/3 · 4 open this week · 2 carried from last week
```

- Rules: overdue = `dueDate < today` (days late = today − dueDate, `1d late`); due today = `dueDate = today`; due tomorrow = `dueDate = today + 1`; later this week = `today + 2 ≤ dueDate ≤ week.end` (omitted when tomorrow is already past the week end); within each section order by dueDate asc, then priority URGENT > HIGH > NONE, then createdAt asc. Day index: Mon = day 1 … Sun = day 7. Footer always present when any open task exists; the "carried" part is omitted when the count is 0.
- Quiet day (overdue, today and tomorrow all empty, but open tasks exist): header line, then `Nothing due today · N open this week`, then the `Later this week` section if any, then the footer. Fully empty (no open non-Done tasks anywhere on this week's board and nothing in progress, no overdue): header line, then `Nothing planned this week. Easy day.`, then any Backlog overdue items would already have made the day non-quiet, so nothing else.
- Always send (the quiet-day note counts). Marker written only after Telegram accepts the message (existing behaviour).
- Pure builder `buildMorningDigest(data: DigestData, now: Date): string` in a Prisma-free module `lib/digestText.ts`; loader `loadDigestData(now)` and `sendMorningDigest(now)` in `lib/digest.ts`; `lib/reminders.ts` keeps `sendDueTodayReminder` as a thin re-export alias of `sendMorningDigest` so `scheduler.ts`/`catchUp.ts` need only an import rename (rename them to the new name; drop the alias if nothing else imports it).
- Tests (vitest) on the pure builder: full digest with every section; overdue days-late pluralisation (`1d late`, `3d late`); project suffix present/absent; later-this-week omitted on Saturday/Sunday; Monday day index 1 and Sunday 7; quiet day note; empty board note; truncation at 10 with `… and N more`; total length under 4096 with 60 overdue tasks. One test on `loadDigestData` with mocked Prisma asserting the `where` filters. Update `lib/reminders.test.ts` mocks (`task.findMany`, `taskEvent.findMany`, `project` include) so catch-up tests still pass.
- Bundle: server-only code; `npm run build` route table unchanged (`/` 281, `/review` 136, `/archive` 136 kB).
- Docs: README "Telegram" section describes the 09:00 digest (sections, quiet-day note, catch-up); PRODUCT.md rituals gain "a morning digest at 09:00"; `docs/superpowers/specs/2026-10-31-phase-2-design.md` Phase 3 note for the digest updated to say the content shipped and only Done/Snooze buttons and commands remain.
- Env: every command prefixed with `TELEGRAM_BOT_TOKEN= TELEGRAM_CHAT_ID=`; no servers on 3000; no docker.

| Task | Model | Where | Reviewer |
|---|---|---|---|
| 1 Morning digest | executor (Opus) | in place (feat/morning-digest) | reviewer (Sonnet) |

## Task 1: Morning digest

**Goal:** Replace the "Due today" list with the morning digest defined in Global Constraints, with tests and docs.

**Steps:**
1. `lib/digestText.ts`: `DigestData` type (`today`, `week`, tasks `{ id, title, dueDate, status, priority, createdAt, projectName }`, `inProgress`, `openThisWeek`, `carried`) and `buildMorningDigest`.
2. `lib/digest.ts`: `loadDigestData(now)` (one `task.findMany` with `project: { select: { name } }`, one `taskEvent.findMany` for carried ids, counts derived in memory) and `sendMorningDigest(now)` that sends and writes `REMINDER_SENT_KEY`.
3. Rename call sites in `lib/scheduler.ts` and `lib/catchUp.ts`; remove `sendDueTodayReminder` from `lib/reminders.ts` if unused.
4. Tests as listed; `npm test`, `npx tsc --noEmit`, `npm run build`.
5. Docs as listed.

**Commit:** `feat(telegram): morning digest with overdue, due and week sections` (+ `docs:` commit if separate). Each commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
