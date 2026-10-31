# Product

## Register

product

## Users

One person: the owner, self-hosting this board on their own machine. They open it in the evening in a dim room, usually at the start or end of a work session, to decide what this week holds and to move cards as work happens. They are fluent in tools like Linear and expect the same quietness and speed. There is no onboarding, no second user, no admin.

## Product Purpose

A weekly to-do kanban with four columns: Backlog, This Week, In Progress, Done. The week is the unit of planning. Every Monday at 00:00 Asia/Manila the board resets itself: unfinished work falls back to Backlog, finished work is archived. The owner should be able to glance at the board and know, in under two seconds, what is due, what is in motion, and what is left this week. Success is a board that is opened daily, touched briefly, and never fought with.

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
5. **Nothing extra.** No settings, no filters, no tags. If a control does not move a card or change its three fields, it does not exist.

## Accessibility & Inclusion

WCAG 2.1 AA: text contrast at or above 4.5:1, visible focus rings on every interactive element, status conveyed by text as well as color. Drag-and-drop must have a keyboard path (dnd-kit's KeyboardSensor plus the status select in the edit dialog). Honor `prefers-reduced-motion` by disabling non-essential transitions.
