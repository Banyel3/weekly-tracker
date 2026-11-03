# Design audit — Weekly Tracker (preview build e371ad1)

Target: http://localhost:3002 (production build of `feat/phase-2` at e371ad1, owner's data copy). Mode: full, report-only (fixes dispatched separately as Task 7g). Driver: gstack headless browser (Aside not installed). Classifier: OPERATE (app UI). Register per PRODUCT.md: product, evening use, Linear-like. Detector: not installed. Static scan of the rendered DOM: not run.

Screenshots: `screenshots/first-impression.png` (not captured: path restriction; `board-desktop.png` is the same view), `board-desktop.png`, `board-tablet.png`, `board-mobile.png`, `dialog-desktop.png`, `theme-desktop.png`, `review-desktop.png`, `review-mobile.png`, `archive-desktop.png`.

## First impression (desktop 1280/1440)

The site communicates **a quiet personal planning tool**: indigo-tinted surfaces, one violet accent, one typeface, no decoration. I notice **the week calendar is a large empty box** that takes a third of the screen while holding nothing, and the four board columns below repeat the emptiness. The first 3 things my eye goes to are: **the 100% progress ring**, **the violet "Tue 3" today pill**, **the "Done" column with the only two cards**. Those are the right three for a Tuesday with nothing planned, so the hierarchy is honest. One word: **restrained**.

Page Area Test: sidebar (nav + projects), stats row, week calendar, board. All four nameable in two seconds. Trunk test (board): site ✓ (week range), page ✓ (Board highlighted), sections ✓, options ✓, where am I ✓, search ✓ → PASS.

## Inferred design system (rendered)

- Fonts: 1 family (Geist, Geist Fallback, system-ui). ✓
- Colors: 12 unique non-transparent values on the board. ✓ (≤12). Cool neutral palette, consistent.
- Headings: h1 14px/500 (week range), h2 12–14px/400–500. **Flat hierarchy**: h1 is the same size as the section h2s; column h2s render at weight 400 while other h2s are 500 (`flat-type-hierarchy`).
- Spacing: 4px scale, panel gap 16, card padding 8/10. ✓
- `color-scheme: dark` on html ✓. `text-wrap` on h1: `wrap` (no `balance`).
- Interactive targets under 24px on desktop: calendar day headers 20px tall, `in archive` link 16px tall. Coarse-pointer rules exist in CSS (not verifiable in the headless driver).
- Load: DOMContentLoaded 101 ms, load 173 ms (prod build). ✓

## Findings

Impact: high / medium / polish. All observations from the screenshots named above.

### Mobile (375) and tablet (768)

- **FINDING-001 (high, hierarchy/responsive) — Carousel guide labels collide.** `board-mobile.png`, `board-tablet.png`: the centre label ("In progress · 0") is printed over the neighbour labels ("This week", "Done"); at 768 the overlap reads as garbage ("Backlog" over "In progress 0"). The three slots share one row without widths. Fix: three-column grid (`grid-cols-[1fr_auto_1fr]`), neighbour labels `truncate` with `justify-self` start/end, centre label `whitespace-nowrap`; dots row below unchanged.
- **FINDING-002 (high, responsive) — Current column is not centred; the previous column is cut mid-text at the left edge.** `board-mobile.png`: "nothing here" is clipped at x<0 while the right neighbour peeks correctly. Fix: `scroll-padding-inline` / `scroll-snap-align: center` with symmetric horizontal padding (`px-6`) on the scroller so both neighbours peek ~12px; verify `scrollLeft` initial calc uses the padded width.
- **FINDING-003 (medium, responsive) — Tablet shows one 740px-wide empty column.** `board-tablet.png`: at 768 the carousel wastes the width. Fix: between 600 and 899px show two columns per page (`w-[calc(50vw-1.5rem)]`), guide strip shows the pair.
- **FINDING-004 (medium, content) — "in archive" orphan under the search field on phones.** `board-mobile.png`: a bare text link floats under the input. Fix: on phones drop it (Archive is in the tab bar); on desktop make it an outline `Button size="sm"` with the `Archive` icon next to the search input.
- **FINDING-005 (medium, layout) — Empty column panel is 600px tall with one muted line at the top.** Mobile board carousel: `min-h-[60dvh]` makes empty states look broken. Fix: `min-h-[40dvh]` on phones and vertically centre the empty state text in the column.
- **FINDING-006 (polish, a11y) — Two `h1` elements in the DOM** (sidebar header and the sheet's copy). Fix: the sheet copy becomes `p` with `aria-hidden`, or the sheet reuses the same node.

### Desktop board

- **FINDING-007 (high, hierarchy) — The week calendar is a 150px-tall empty box for an empty week.** `board-desktop.png`: 7 columns of nothing dominate the first screen. Fix: when no task in the week has a due date, collapse the day columns to a 56px header row with the dates and a single muted line `no due dates this week · drag a card here or set a due date`; keep full height as soon as one chip exists. Same rule for the Month view.
- **FINDING-008 (medium, typography) — Flat heading hierarchy.** h1 (week range) 14px/500 equals the section titles; column h2s are 400. Fix: week range `text-[15px] font-semibold`, section titles `text-sm font-medium`, column h2 labels `font-medium` (500) consistently; keep stats card titles at 12px/500.
- **FINDING-009 (medium, interaction) — Two add affordances per column** (header `+` icon and footer `Add` button). Fix: keep the footer `Add` only (it is the one users find), remove the header icon button; the column header keeps chip + count.
- **FINDING-010 (medium, layout) — Search field is a bare label + input on the board header.** `board-desktop.png`: "Search" text label, input, "in archive" link read as three unrelated pieces. Fix: one `Input` with a leading `Search` icon and placeholder `Search tasks`, no visible label (keep `sr-only`), and the Archive action as described in FINDING-004.
- **FINDING-011 (polish, hierarchy) — Stats row on day 2 shows "100%" and "on pace for 7" for 2 of 2.** Data-driven, but the ring reads as a boast. Fix: when planned < 3, show the ring at 0 opacity? No: keep the ring, but hide `on pace for K` until day 3 (`day > 2`) so the projection is not from one or two days of data.
- **FINDING-012 (polish, color) — Done cards at 60% opacity dim the project chip and title together,** which makes the dot colour hard to read. Fix: dim title and meta text via `text-muted-foreground`, keep the chip dot at full opacity.

### Dialog

- **FINDING-013 (polish, layout) — Status select is the last field even in create mode,** where it was preset from the column. Fix: in create mode show Status as a compact read-only chip in the description line (`Add a task to In progress`) and omit the select; keep the select in edit mode. (The description line already says it.)
- No other issues: rhythm, controls, footer and close are consistent (`dialog-desktop.png`).

### Review

- **FINDING-014 (medium, layout) — Flow and Signals cards have unequal heights with dead space at the bottom of Flow.** `review-desktop.png`. Fix: `items-start` on the grid so cards size to content, or move one signal (`reopened`) into Flow to balance 4/4.
- **FINDING-015 (polish, content) — Footnote under the chart is two dense lines of muted prose.** Fix: shorten to one line (`planned = tasks put on a week · finished excludes same-week reopens · deleted shown as dropped`) and move the rest to a `Hint` on the chart title.
- **FINDING-016 (polish, content) — `Carried over from last week · 0` keeps a `·` separator before the count.** Fix: render the count as a muted `Badge variant="outline"` like the nav counts.
- Review on mobile reads well; the summary preview block is the one place where a bordered inner box sits inside a panel (acceptable: it is a quote).

### Theme picker, archive

- Theme picker popover with four-swatch previews is clear. Archive empty state is fine. No findings.

### Cross-page consistency

- Sidebar, page titles (`text-sm font-medium`), panel radius and spacing are consistent across Board, Review, Archive. The only inconsistency is the board header's search cluster (FINDING-010) versus the archive page's search (same pieces, aligned right).

### Motion, states, performance (observed)

- Transitions are transform/opacity only; reduced motion handled (not emulated here). Load 173 ms. Console: 6 × 404 for `_next/static` chunks in the mobile review capture, caused by a browser tab held open across the preview rebuild (stale chunk hashes), not by the app.

## Goodwill (board → add task → review)

Start 70. Open dialog (+10 obvious top task) 80. Empty calendar box competing for attention (−5 ambiguous) 75. Review page answers "how is the week going" at once (+10) 85. FINAL 85/100: healthy.

## Scores

Grades start at A; high −1 letter, medium −½.

| Category | Findings | Grade |
|---|---|---|
| Visual hierarchy | 001 high, 007 high, 008 medium, 011 polish | C+ |
| Typography | 008 medium | A- |
| Color & contrast | 012 polish | A |
| Spacing & layout | 005 medium, 010 medium, 014 medium | B- |
| Interaction states | 009 medium | A- |
| Responsive | 002 high, 003 medium, 004 medium | C+ |
| Motion | — | A |
| Content & microcopy | 015, 016 polish | A |
| AI slop | none of the 11 patterns; cards are the interaction; one accent | A |
| Performance feel | — | A |

**Design Score: B.** **AI Slop Score: A** ("looks designed, not assembled; the remaining problems are layout bugs on small screens, not slop").

Litmus: brand unmistakable in first screen YES (week range + board); one strong anchor YES (today pill/ring); scannable by headings YES; one job per section YES; cards necessary YES; motion improves hierarchy YES (state-only); premium without decorative shadows YES (there are none).

## Quick wins (< 30 min each)

1. FINDING-001 guide-strip grid.
2. FINDING-002 centred snap with symmetric padding.
3. FINDING-009 remove the header `+`.
4. FINDING-010 search input with icon, archive as a button.
5. FINDING-008 heading weights.

## Deferred

None; everything above is fixable in source. Fixes are dispatched as Task 7g on branch `feat/phase-2`.
