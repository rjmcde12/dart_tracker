# Dart Practice Tracker — MVP Spec

## Purpose

A web app for logging dart practice sessions to track scoring and accuracy
over time. Primary device is an **iPad Mini, landscape orientation**,
used touch-first (tap to select points on a dartboard image — no typing
during a practice session).

This is an MVP. Scope is intentionally narrow: get the core logging loop
working and data persisted locally. History views and a backend database
are later iterations.

The app supports multiple **Game Modes** (Free Play, Cricket Practice, and
more to come) — see [GAME_MODES.md](./GAME_MODES.md) for the full catalog
and rules of each. This file covers the shared app architecture (board UI,
coordinate system, scoring, persistence) that every mode builds on.

## Tech Stack

- **Next.js + React + TypeScript** (App Router)
- Tailwind CSS for layout
- Client-side only for MVP (no server/API routes needed yet)
- Built to run well as a home-screen PWA on iPad, but a plain browser tab
  is sufficient for MVP

## Assets

- `dartboard.svg` — full standard dartboard graphic, used as the source
  for both the full-board panel and the zoomed wedge panel. `viewBox="-250
  -250 500 500"`, centered on the bullseye at `(0,0)`.
- `layout.pdf` — UI mockup: full board on the left, zoomed wedge view on
  the right.

### Dartboard geometry reference (from `dartboard.svg`)

All values are radii in the SVG's local coordinate space (center = bull =
`(0,0)`, board edge ≈ `226`):

| Region | Outer radius | Inner radius |
|---|---|---|
| Double ring | 169.5 | 160.5 |
| Treble ring | 106.5 | 97.5 |
| Outer bull (25) | 16.4 | 6.85 |
| Inner bull (50 / bullseye) | 6.85 | 0 |
| Single (inner, between bull and treble) | 97.5 | 16.4 |
| Single (outer, between treble and double) | 160.5 | 106.5 |
| Miss (outside board) | — | > 226 |

20 sectors of 18° each, numbered in standard dartboard order (20 at top,
going clockwise: 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11,
14, 9, 12, 5), with sector boundaries offset 9° from each number's
center line (confirmed by the `b` divider paths in the SVG). This is the
data needed to convert any `(x, y)` point into `{ sector, ring }` for
scoring.

## Coordinate System

- All positions (Target and Throw Results) are stored as `{ x, y }` in
  the **same coordinate space as `dartboard.svg`'s viewBox** (i.e.
  `-250..250` on both axes, origin at the bullseye).
- The UI maps pointer/tap events on either the full-board SVG or the
  zoomed wedge SVG back into this same `(x, y)` space before storing —
  so a throw logged via the zoom panel and a throw logged via the full
  board are stored identically.

## UI Layout (per `layout.pdf`)

Three panels side by side, landscape:

1. **Left — Full Dartboard**: the complete `dartboard.svg`. Used to (a)
   pick the initial Target, and (b) optionally log Throw Results directly
   on the full board — especially useful for a wild throw that lands far
   from the Target and wouldn't be visible in the zoomed panel.
2. **Center — Zoomed Wedge**: a magnified crop of the sector the user is
   currently targeting, spanning that sector's full 18° wedge from the
   bullseye out past the board edge. Used to refine the Target position
   and/or log Throw Results with more precision, for throws that land
   close to the Target. See "Zoom Orientation" below for exactly how it's
   rotated. If the Target is in/near the bullseye instead of a numbered
   wedge, this panel instead shows a square crop centered on the bull,
   reaching out to just inside the treble ring (no single wedge applies).
3. **Right — Throw Slots**: three slots (Dart 1 / 2 / 3) for the current
   turn. See "Throw Slots & Editing" below.

### Zoom Orientation

The zoom panel always keeps the **same visual orientation as the printed
board** — it does not naively rotate every targeted wedge to point up,
because that would flip bottom-half sector numbers upside-down. Instead:

- A sector on the board's **right half** (center angle < 180°, e.g. 6, 10,
  13) is rotated so its wedge points **up**: double ring at the top, bull
  at the bottom.
- A sector on the board's **left half** (center angle >= 180°, e.g. 8, 11,
  14, 19) is rotated so its wedge points **down** instead: double ring at
  the bottom, bull at the top.
- Example: triple 19 (center angle 198°, left half) shows double 19 at
  the bottom and bull at the top.
- The dartboard.svg's own number-ring text rotates along with the board
  and would end up sideways/upside-down for many sectors, so it's masked
  out (covered with a plain black patch, matching the number ring's own
  black background) and replaced with an upright text label showing the
  sector number, placed at a fixed spot in the unrotated crop (top for
  the "points up" case, bottom for "points down").
- A Target within the outer bull radius (see geometry table) uses the
  square Bull crop instead (no rotation, no number label — 25/50 apply
  regardless of angle).
- The wedge crop shows the **full double ring plus a margin beyond the
  board edge**, so a near-miss throw that lands just outside the wire is
  still visible and taggable rather than being clipped off. The number
  mask is sized to cover only the number-ring band (between the double
  ring's outer edge and the board edge) so it never cuts into the double
  ring itself, and it's layered *below* throw/target markers so a
  near-miss marker landing in that band is never hidden underneath it.

**Zoom panel behavior differs by phase:**

- **While setting a Target**: only taps on the **full board** change
  which sector/wedge the zoom panel displays. Taps inside the zoom panel
  itself never change the zoom window — they only refine the pending
  Target point within the currently displayed wedge.
- **While throwing (turn in progress)**: the zoom panel is locked to the
  confirmed Target's sector and **never changes**, regardless of where
  on the full board a Throw Result is tapped. A wild throw that lands in
  a different sector is only visible on the full board; a throw that
  lands close to the Target is visible (and more precisely taggable) in
  the zoom panel.
- **While editing a past turn** (see Throw Slots & Editing below): the
  zoom panel switches to that turn's own Target sector for the duration
  of the edit, so its darts can be retargeted precisely, then switches
  back to the live current turn's sector once editing is done.

## Core Workflow

1. **New Game** — opens a modal to choose a Game Mode (Free Play, Cricket
   Practice, ...). See [GAME_MODES.md](./GAME_MODES.md) for what each mode
   asks next (e.g. Cricket Practice then asks for a Target variant) and
   how it drives Target placement. Choosing a mode creates the Game record
   (id + mode + start timestamp) and begins the session.
2. **Set Target** — *(Free Play only — other modes place the Target
   automatically; see GAME_MODES.md)*. User taps a point on the full
   dartboard. The zoomed wedge panel updates to show that sector. The user
   can refine the exact point by tapping again on the full board (which
   may also jump the zoom panel to a different sector) or by tapping
   inside the zoom panel (which only refines the point within the
   currently displayed wedge). Each tap replaces the pending Target
   position.
3. **Confirm Target** — *(Free Play only)*. Button in the Throw Slots
   panel (see below). Locks in the Target position for the upcoming
   turn(s).
4. **Log Throws** — user throws 3 real darts, then taps where each landed
   (on either panel, in any order) — 3 Throw Result points collected per
   turn, populating the Throw Slots on the right as they're logged.
5. **Turn ends automatically** — the instant the 3rd dart is logged (no
   button to tap), the turn is saved and the app either starts a new turn
   with the same Target (Free Play) or auto-advances to the mode's next
   Target (Cricket Practice — see GAME_MODES.md), possibly ending the
   game. If a mistake needs fixing, see "Editing a past turn" below —
   there's no window to catch it before it advances.
6. **Move Target** — *(Free Play only)*. Available any time between
   turns. Re-enters the Set Target flow (step 2) to choose a new target;
   otherwise the Target persists across turns by default.
7. **End Game** — ends the session (end timestamp saved), either manually
   (End Game button, available any time) or automatically when a mode's
   sequence completes (e.g. Cricket Practice after the Bull turn).

Note: in Free Play, Target is a free `(x, y)` point, not constrained to a
specific number's center — the user can aim at any spot on the board (e.g.
a specific treble, a spot just off the bullseye, etc.). Scoring logic
(below) is only applied to interpret *Throw Results*, not to constrain
where a Target can be set.

## Throw Slots & Editing

Three slots (labeled Dart 1 / 2 / 3, one per dart of the turn — the
underlying Throw record IDs still use the `a`/`b`/`c` suffix from the Data
Model below) sit to the right of the two board panels:

- Empty before that dart is thrown ("Not thrown").
- Populated live as each throw is logged, showing its score label/value
  and distance from Target (the same data described under Scoring &
  Accuracy).
- Not tappable during normal live play — since the turn ends the instant
  the 3rd dart lands, there's no window where the current turn's own
  slots are click-to-edit. See "Editing a past turn" below for how
  mistakes get fixed instead.
- The **Confirm Target** button (Free Play only, see GAME_MODES.md) lives
  in this panel — it only appears while setting a Target, before any of
  the panel's slots exist.

### Editing a past turn

Below the Throw Slots, the Cricket scoreboard / Free Play "Recent Turns"
panel (see GAME_MODES.md) lists already-played turns. Tapping a played
row there — not the live Throw Slots above it — is how a mistake gets
fixed:

1. Tapping a played row enters editing for that turn: the Throw Slots
   panel swaps from showing the live current turn to showing that past
   turn's 3 darts instead (with a header naming which turn), the board
   panels show that turn's Target and darts, and the zoom panel switches
   to that turn's Target sector.
2. Tapping one of the 3 slots arms it; the next tap on **either board
   panel** overwrites that dart's position (recomputing its score,
   distance, and — for Cricket — its marks), then disarms automatically.
   Repeat for any other dart in that turn that needs fixing.
3. Tapping **Done** (or tapping the same row again) exits editing,
   restoring the live current-turn view and zoom.

While editing is active, Confirm Target / Move Target are hidden and
board taps are captured by the armed slot (if any) rather than logging
new darts for the live turn — finish or cancel the edit first.

## Scoring & Accuracy

- **Score label per throw**: computed from the throw's `(x, y)` using the
  geometry reference above → `{ sector, ring }` → label such as `T20`,
  `D16`, `S5`, `25` (outer bull), `50` (bullseye), or `Miss`. Numeric
  value derived the standard way (e.g. `T20` = 60, `D16` = 32, `25` = 25,
  `50` = 50).
- **Turn score**: sum of its 3 throws' numeric values.
- **Accuracy**: Euclidean distance between the Target `(x, y)` and each
  Throw Result `(x, y)`, in the same SVG units. Stored per throw so it
  can be averaged/trended later (e.g. average distance per turn, per
  game, over time).

## Data Model (for IndexedDB, MVP persistence)

```
Game
  id             (uuid)
  mode           "free-play" | "cricket-practice" | ...
  cricketVariant "single" | "triple" | null   // only for cricket-practice
  startedAt      (timestamp)
  endedAt        (timestamp | null)

Turn
  id            (`${gameId}-t${n}`, sequential per game)
  gameId
  target        { x, y }
  cricketTarget { kind: "number", number } | { kind: "bull" } | null
                // only set for cricket-practice turns; see GAME_MODES.md
  createdAt

Throw
  id            (`${turnId}${suffix}`, suffix ∈ "a" | "b" | "c")
  turnId
  gameId
  position      { x, y }
  score         { sector, ring, label, value }   // computed, cached
  distanceFromTarget                              // computed, cached
  createdAt
```

- Persisted via IndexedDB (e.g. through the `idb` helper library) so
  practice data survives app refresh/close on the iPad without needing a
  backend yet.
- This schema is designed to map cleanly onto a future real database
  (e.g. Postgres tables `games` / `turns` / `throws`) when sync is added
  — that migration is a later iteration, not part of this MVP.

## Out of Scope for MVP

- Backend / remote database sync (local IndexedDB only for now)
- History or progress views (charts, trends, past-game list) — data is
  captured but not yet visualized beyond the live session
- Standard dart games beyond what's listed in GAME_MODES.md (e.g. 501) —
  new modes are added there as they're built
- User accounts / multi-user support
- Editing or deleting turns/games once the *game* has ended — only turns
  within the currently in-progress game can be edited (see "Editing a
  past turn"), and only by adjusting individual dart positions, not by
  adding/removing darts or turns
- Portrait orientation support

## Confirmed Decisions

1. **Ending a game**: explicit **End Game** button records `endedAt`.
2. **Zoom panel trigger**: while setting a Target, only taps on the
   **full board** change which sector the zoom panel displays; zoom-panel
   taps only refine the point. Once throwing starts, the zoom panel locks
   to the Target's sector and never changes for the rest of the turn (or
   subsequent turns) — full-board taps just log a Throw Result without
   moving the zoom window. It only changes again if the user enters
   editing for a past turn (see below), switching to that turn's sector
   for the duration.
3. **Bounds**: a tap outside the board is a valid `Miss` throw (value 0),
   not ignored.
4. **Auto-end turn**: a turn ends the instant its 3rd dart is logged —
   no End Turn button. To fix a mistake, tap that turn's row in the
   Cricket scoreboard / Free Play Recent Turns panel, which arms the
   same slot-click-then-board-tap editing flow that used to live in the
   Throw Slots panel, now scoped to whichever past turn was tapped.
