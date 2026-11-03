# Product

*Project management for one person, with the week as the unit and a board that resets itself every Monday.*

## Register

product

## Users

One person: the owner, self-hosting this board on their own machine. They open it in the evening in a dim room, usually at the start or end of a work session, to decide what this week holds and to move cards as work happens. They are fluent in tools like Linear and expect the same quietness and speed. There is no onboarding, no second user, no admin.

## Product Purpose

A weekly kanban with four columns: Backlog, This Week, In Progress, Done. The week is the unit of planning. Each task can belong to one project, shown as a small coloured chip, so the owner can tell at a glance which part of life it belongs to. The owner should be able to glance at the board and know, in under two seconds, what is due, what is in motion, and what is left this week. Success is a board that is opened daily, touched briefly, and never fought with.

Around the board sits a small workspace, reached from the sidebar on a laptop and the bottom tab bar on a phone: **Board** (with the stats row and the week calendar above it), **Calendar** (tasks by due date, drag to reschedule), **Weekly review**, and **Archive** (past weeks, searchable, with restore). Phase 3 tools are listed as `soon` and do nothing yet. The app installs to a phone's home screen and is reached over the owner's tailnet.

## Rituals

The product is built around three recurring moments:

1. **Monday rollover.** At 00:00 Asia/Manila every Monday the board resets itself: finished work is archived, unfinished work returns to Backlog marked `last week`, and the sidebar says how many came back. Tasks carried twice or more get a nudge.
2. **Friday summary.** At 18:00 every Friday, if Telegram is configured, one message states what was finished of what was planned, per project, and what keeps getting carried over.
3. **Weekly review.** A page to read the week before planning the next: this week so far, flow and signals, eight weeks of planned versus finished, and the carried-over list with one-tap move, keep or delete.

## Brand Personality

Quiet, precise, personal. The interface should feel like a well-kept notebook rather than a product. It never announces itself, never celebrates, never nags. Tone of copy: plain, short, lower-case friendly where natural, no exclamation marks.

## Anti-references

- Generic SaaS dashboard: gradients, hero metrics, glass cards, purple-to-blue accents, marketing-grade headlines.
- Playful or gamified task apps: confetti, streaks, badges, emoji as UI, blobby shapes, bouncy motion.
- Corporate enterprise tools: Jira-style density, grey-on-grey toolbars, nested panels, icon soup.
- Trello-style colored column backgrounds and chunky card shadows.

## Design Principles

1. **The board disappears into the week.** Structure is the affordance: four predictable columns, cards that read in one line, a header that states the date range and nothing else.
2. **Quiet by default, loud only for time.** The single accent is reserved for what is overdue or active; everything else is tinted neutral.
3. **Fast beats pretty.** Every interaction is immediate; drag, drop, edit, delete happen without waiting for choreography. Motion only confirms state.
4. **Evening-first.** Designed for a dim room: low-glare surfaces, restrained contrast between layers, no pure white or pure black anywhere.
5. **Nothing extra.** No settings screens, no tags, no custom fields. A task has five fields (title, project, due date, note, status) plus a priority (none, high, urgent) and a short checklist; if a control does not move a card, change one of those, or serve one of the three rituals, it does not exist. Filtering is limited to search, a project, or a calendar day.

## Accessibility & Inclusion

WCAG 2.1 AA: text contrast at or above 4.5:1, visible focus rings on every interactive element, status conveyed by text as well as color. Drag-and-drop must have a keyboard path (dnd-kit's KeyboardSensor, the status select in the edit dialog, and the Move sheet on phones). Touch targets are at least 44px on coarse pointers. Honor `prefers-reduced-motion`: no movement, only short opacity fades.
