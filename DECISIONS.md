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
