# Yumi board reliability fixes (autopilot, 2026-11-07)

Source: read-only investigation of Yumi's logs and code on 2026-11-07. Yumi's moves that reached the tracker all
succeeded; the unreliability comes from Yumi itself. Owner picks (Sized decisions, then "go autopilot for this one"):

- Clock (C): set the server host to Asia/Manila. The owner runs `sudo timedatectl set-timezone Asia/Manila`; Claude
  cannot (no passwordless sudo). Added on top: `current_time` states its UTC offset.
- Board tools after reboot (B): retry at boot. Added on top: if the boot retry gives up, try again on later turns.
- Stale ids (D): Yumi verifies an id with `get_task` before every write. Added on top: tracker tool descriptions
  point at `list_tasks`, and Yumi's result names the task's title.
- Time of day (F): tracker tool descriptions say due dates are dates only.
- Out of scope: E (schedules per device), restarting `yumi.service` (that is a deploy), request logging on the
  tracker.

No separate spec: this plan and the investigation report are the authority.

## Global Constraints

- Yumi repo: `/home/ban/yumi`, base branch `continuation` (what the server runs; `main` is 56 commits behind and
  stale since 2026-08-30). Never edit, check out, stash or commit in `/home/ban/yumi` itself: it is the live
  working directory of the running `yumi.service`. Work only in worktrees under `/home/ban/worktrees/`.
- Never read or print `/home/ban/yumi/.env`, `/home/ban/weekly-tracker/.env`, or any token. Tests use fakes; no call
  to the live tracker or Telegram.
- Yumi checks: modules carry `demo()` self-checks run as `python core/<module>.py` from the worktree root, with the
  interpreter `/home/ban/yumi/.venv/bin/python`. Add the new checks to the touched module's `demo()`.
- Tracker toolchain: npm with `package-lock.json`; tests `npm test` (vitest run); no CI; `main` deploys only when the
  owner rebuilds the docker stack by hand.
- Commits: conventional (`fix(board): ...`), full-sentence body. Draft PRs only. No merges.
- Boot retry delays: 2, 4, 8, 16, 30 seconds (about 60 s in all), in a background daemon thread, never blocking
  startup. Per-turn fallback: at most one attempt every 30 s, HTTP timeout 2 s for that attempt.
- `current_time` output format: `It is Saturday 07 November, 06:55 PM (UTC+08:00).`

## Task table

| Task | Repo / branch | model | where | reviewer model |
|---|---|---|---|---|
| 1 Boot retry and per-turn fallback | yumi `fix/board-boot-retry` from `continuation` | executor (Opus) | worktree: other repo, own PR, live checkout | reviewer (Sonnet) + final-reviewer (concurrency) |
| 2 Verify ids before writes | yumi `fix/board-verify-ids` stacked on Task 1 | executor (Opus) | same yumi worktree, after Task 1 | reviewer (Sonnet) |
| 3 current_time states its offset | yumi `fix/clock-offset` from `continuation` | mech-executor (Sonnet) | same yumi worktree, after Task 2 | reviewer (Sonnet) |
| 4 Tool descriptions | weekly-tracker `fix/agent-tool-descriptions` from `main` | mech-executor (Sonnet) | worktree: own PR | reviewer (Sonnet) |

## Task 1: board tools survive a slow tracker at boot

Files: `core/board.py`, `core/tools/__init__.py`, possibly `core/pipeline.py` (where the tool list for a turn is
read).

Today `Board.definitions()` makes one attempt when the registry is built (`core/tools/__init__.py:115-117`); on
failure Yumi has no board tools for the whole session (2026-11-06: 4 h 28 min).

Behaviour:
1. At registry build, try once as now. If that fails, start a background daemon thread that retries with delays 2,
   4, 8, 16, 30 s. When a fetch succeeds, register the board tools (same names, risks and confirms as today,
   including the `list_projects` warm-up) and log `[board] tools loaded after N attempts`.
2. If the thread gives up, a later turn retries: before a turn reads its tool list, if board tools are still
   missing and the last attempt was at least 30 s ago, make one attempt with a 2 s HTTP timeout. Success registers
   the tools for that turn and every later one.
3. Registration is atomic with respect to a turn reading the tool list (a lock, or swapping in a new list), and
   tools are registered at most once even if the thread and a turn succeed together.
4. When the board is not configured (`board.make` returns None) nothing changes: no thread, no per-turn attempt.

Self-checks in `core/board.py` `demo()` (fake transport, no sleeps longer than needed; make the delays injectable):
- transport fails twice then succeeds: tools appear after the third attempt, registered once;
- transport always fails: the thread stops after the 5 delays; a per-turn attempt 30 s later succeeds and
  registers; a second per-turn attempt inside 30 s makes no call;
- thread and per-turn succeeding at the same moment register the tools once.

## Task 2: verify a task id before every board write

Files: `core/board.py`.

For `update_task`, `move_task`, `snooze_task`, `delete_task` and `restore_task`, `Board.run` first calls `get_task`
with the id.
- Not found (the tracker answers `ok: false` with a 404, or no task): return
  `No task with id <id> on the board. Find it with board_list_tasks first.` and make no write call.
- Found: run the write; prefix the compacted result with `<Title>: ` (the title from that `get_task`), so Yumi's
  answer names the task it changed.
- The board not answering on `get_task`: return the same "The board did not answer: ..." text as today; no write.
- Reuse the title for `confirm()` (delete_task asks first) so one write costs one `get_task`, not two.
- `create_task` and reads are unchanged.

Self-checks in `demo()`: unknown id makes no write call and returns the message above; known id writes once and the
result starts with the title; a delete's confirm plus run calls `get_task` once.

## Task 3: current_time states its UTC offset

Files: `core/tools/__init__.py`.

`current_time` returns `datetime.now().astimezone()` formatted as `It is %A %d %B, %I:%M %p (UTC+HH:MM).`, e.g.
`It is Saturday 07 November, 06:55 PM (UTC+08:00).` The description becomes
`The current local date and time, with its UTC offset.` Add a self-check in that module's `demo()` that the output
matches `\(UTC[+-]\d\d:\d\d\)\.$`.

## Task 4: tracker tool descriptions point at list_tasks and say dates only

Files: `lib/agent/ops.ts`, `docs/agent-api.md`, and `lib/agent/ops.test.ts` only if a test pins a description.

Append to the existing descriptions (keep the current text, add these sentences):
- `get_today`: `Undated Backlog tasks are not included; to find a task by title use list_tasks with query.`
- `update_task`, `move_task`, `snooze_task`, `delete_task`, `restore_task`: `Take the id from a get_task or
  list_tasks result in this conversation; ids from older messages may be stale.`
- `create_task`, `update_task`, `snooze_task`: `Due dates are dates only (YYYY-MM-DD, Asia/Manila); the board stores
  no time of day, so do not promise one.`
Mirror the same sentences in `docs/agent-api.md` where each tool is described. Commit this plan file
(`docs/plans/2026-11-07-yumi-fixes.md`) and `DECISIONS.md` on this branch too. `npm test` passes.
