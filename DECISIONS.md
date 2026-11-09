# Decisions: Yumi board reliability fixes (autopilot, 2026-11-07)

Plan: `docs/plans/2026-11-07-yumi-fixes.md`. The owner picked the direction for each fix in Sized mode, then said
"go autopilot for this one". Decisions below are the ones made after that, on the owner's behalf.

## Overall

- **Where the Yumi pull requests point.** Options: `main`, `continuation`. Chose `continuation`: it is the branch the
  server runs, and `main` is 56 commits behind and untouched since 2026-08-30. Undo: easy (retarget the PRs).
- **Whether the boot retry may block startup.** Options: block for up to about 60 s, or retry in a background
  thread. Chose the background thread: the PC copy of Yumi also has the board configured, and blocking would delay
  its voice start by a minute whenever the tracker is unreachable from the PC. Undo: moderate (small concurrency
  code to remove).
- **Restarting yumi.service and setting the host timezone.** Not done. Restarting a live service is a deploy, and
  the timezone change needs sudo. Both are left to the owner. Undo: not applicable.
- **Request logging on the tracker's agent routes.** Left out: not picked, and it adds log volume on every Yumi
  call. Worth adding if moves fail again and the cause is unclear. Undo: not applicable.
- **Schedules shared between the PC and the server (finding E).** Left out: it is a sync design question, not a
  fix. Undo: not applicable.

## Task 4: tracker tool descriptions

- **Change the descriptions or the tool behaviour.** Options: add a title lookup to the write tools, or only steer
  the model with better descriptions. Chose descriptions only: Yumi now refuses unknown ids itself, so the tracker
  only needs to tell the model where to look. Undo: easy.

## Task 1 (yumi): board tools survive a slow tracker at boot

- **Where the per-turn retry hooks in.** Options: an optional `refresh` callable on the registry that the
  pipeline calls before reading the tool list; making the tool-list read retry by itself; returning the loader
  from `build()`. Chose the `refresh` callable: a retrying tool-list read would make a blocking network call on
  the event loop, and changing `build()` would touch every caller. Undo: easy.
- **How a turn sees a consistent tool list.** Options: a lock that every reader takes, or swapping in a new
  copy of the tool list on each add. Chose the copy swap: readers need no lock, and it also stops a late add
  from being lost. Undo: easy.
- **Registering at most once.** A `loaded` flag re-checked under a lock after the fetch, so the network call is
  never held under the lock. Undo: easy.
- **A malformed or empty answer from the tracker** counts as a failed attempt and is retried (from review).
  Undo: easy.
- **Timeouts.** The per-turn attempt keeps 2 s end to end, including the project-name warm-up; boot and the
  background thread keep 6 s. Undo: easy.

## Task 2 (yumi): check a task id before every write

- **Sharing the title between the question and the write.** Options: one slot, a per-id cache, or no sharing.
  Chose a per-id cache: one question can cover several writes in a round. Undo: easy.
- **How long a cached title stands in for the check.** Options: until used, 60 seconds, or the same turn only.
  Chose 60 seconds: a declined question must not leave a permanent pass for that id. Known cost: a phone
  confirmation can take up to 90 s, so a slow phone delete does a second lookup. Undo: easy (one constant).
- **What counts as "not found".** "not found" in the tracker's error text, or an answer with no task. The
  tracker's real message is "task not found: <id>". Undo: easy.
- **Title on refused writes too.** A refused write still names the card ("Pay rent: The board refused: ...").
  Undo: easy.
- **Not using the pre-question check hook.** The id check lives in the one place every write goes through. An
  unknown id on a delete is therefore asked about before it is refused; moving the check earlier is a
  follow-up. Undo: easy.

## Task 3 (yumi): current_time states its offset

- A small helper function instead of an inline lambda, so the self-check can test it. Undo: easy.

## Final review

- No blocking findings. Six minor items are deferred, listed in the pull requests. Run Yumi's full
  `selfcheck.py` once on the PC before restarting Yumi with these changes.

# Decisions: Future tasks and add-from-calendar (autopilot, 2026-11-09)

Plan: `docs/plans/2026-11-09-future-tasks.md`. The owner picked the design in Sized mode (a FUTURE status; dated
Future tasks stay in Future until their week, then move to This week by themselves, both hourly and on save;
clicking a calendar day adds a task there), then said "build the future task now on autopilot then merge".

## Overall

- **Future tasks in the board API.** Options: a fifth board column, or a separate `future` list. Chose the separate
  list: the four-column board stays untouched. Undo: easy.
- **Events for Future.** Future behaves like Backlog: moving into This week or In progress records "planned",
  moving back records "unplanned", Future to Backlog records nothing. Undo: easy.
- **Deploy is not automatic.** Deploying adds a value to a database enum, which Postgres cannot cleanly remove, so
  it waits for the owner, with a backup first. Undo: not applicable.

## Task 1: status, promotion, API

- **Finding tasks to promote.** Options: a second locked query, or widening the rollover's existing locked query.
  Chose widening it: one statement, one set of row locks, the same guard against overlapping runs. Undo: easy.
- **Which saves promote.** Only saves that set a task to Future or change a Future task's due date; the hourly run
  catches anything else within the hour. Undo: easy.
- **Review exclusion.** Future tasks are dropped once at the top of the weekly review, which covers planned,
  finished, overdue and carried counts at once. Undo: easy.
- **Health signal.** Promotions do not update "last rollover", which means "last archived or returned a task".
  Undo: easy.
- **A test that broke when the calendar week turned** was fixed by pinning its clock, in its own commit. Undo:
  trivial.
- **Enum order.** Future sits after Backlog, so agent task lists group Backlog, Future, This week. Undo: easy.

## Task 2: Future page

- **One task list in the browser.** Future tasks share the same list as board tasks, so moves, undo and a
  server-side promotion all work through the same update path. Undo: easy.
- **Badges.** The server's live count leaves out Future; the sidebar shows Board and Future counts separately, so
  nothing is counted twice. Undo: easy.
- **Sidebar.** "Future tasks" moved up beside Calendar, since it is a real page now. Undo: trivial.
- **Light page.** Future rows reuse the archive row style rather than the draggable card, so the page does not load
  drag-and-drop code. Undo: easy.
- **Colour.** Future uses the muted text colour; the accent stays reserved for what is overdue or active. Undo:
  trivial.

## Task 3: add from the calendar

- **Which column.** Compared with the board's current Manila week, not the device clock. A day this week or earlier
  goes to This week (an earlier day becomes an overdue task); a later day goes to Future. Undo: trivial.
- **Telling empty space from a chip.** One check on what was clicked, instead of changing every chip. Undo: easy.
- **Drag release.** No extra guard: the drag library already swallows the click that ends a drag (checked in its
  source). Undo: easy.

## Final review

- No blocking findings. Three small fixes ride in a follow-up PR: keyboard focus after a promoting save on the
  Future page, the sidebar "back from last week" count leaving out tasks parked in Future, and typed test mocks.
- Accepted as is: a task carried in from last week and then parked in Future drops out of last week's planned and
  carried counts, as the plan intends.
