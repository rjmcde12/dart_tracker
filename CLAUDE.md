# Dart Practice Tracker — MVP Spec

## Purpose

A web app for logging dart practice sessions to track scoring and accuracy
over time. Primary device is an **iPad Mini, landscape orientation**,
used touch-first (tap to select points on a dartboard image — no typing
during a practice session).

This is an MVP. Scope is intentionally narrow: get the core logging loop
working and data persisted locally. History views, real scoring games
(501/cricket/etc.), and a backend database are later iterations.

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

Two panels side by side, landscape:

1. **Left — Full Dartboard**: the complete `dartboard.svg`. Used to (a)
   pick the initial Target, and (b) optionally log Throw Results directly
   on the full board.
2. **Right — Zoomed Wedge**: a magnified crop of the sector the user is
   currently targeting — from the bullseye out to the outer edge of the
   double ring, spanning that sector's full 18° wedge, rotated so the
   wedge points straight up (matches the mockup). Used to refine the
   Target position and/or log Throw Results with more precision.

Which sector is "currently targeted" (and therefore what the zoom panel
shows) is determined only by taps on the **full board**. A tap inside the
zoom panel itself never changes which sector/wedge is being zoomed —
it only sets a point within the currently displayed wedge (refining the
Target, or logging a Throw Result). This applies both during Target
refinement and during Throw logging.

## Core Workflow

1. **Start Game** — creates a new Game record (id + start timestamp).
2. **Set Target** — user taps a point on the full dartboard. The zoomed
   wedge panel updates to show that sector. The user can refine the exact
   point by tapping again on the full board (which may also jump the
   zoom panel to a different sector) or by tapping inside the zoom panel
   (which only refines the point within the currently displayed wedge).
   Each tap replaces the pending Target position.
3. **Confirm Target** — user taps a Confirm button. The Target position
   is locked in and saved for the upcoming turn(s).
4. **Log Throws** — user throws 3 real darts, then taps where each landed
   (on either panel, in any order) — 3 Throw Result points collected per
   turn.
5. **End Turn** — appears once 3 Throw Results are logged for the current
   turn. Tapping it saves the turn, clears the 3 Throw Results, and starts
   a new turn with the **same Target** still active.
6. **Move Target** — available at any time between turns. Re-enters the
   Set Target flow (step 2) to choose a new target; otherwise the Target
   persists across turns by default.
7. **End Game** — ends the session (end timestamp saved). Exact trigger
   UI (explicit button vs. navigating away) — see Open Questions.

Note: Target is a free `(x, y)` point, not constrained to a specific
number's center — the user can aim at any spot on the board (e.g. a
specific treble, a spot just off the bullseye, etc.). Scoring logic
(below) is only applied to interpret *Throw Results*, not to constrain
where a Target can be set.

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
  id            (uuid)
  startedAt     (timestamp)
  endedAt       (timestamp | null)

Turn
  id            (`${gameId}-t${n}`, sequential per game)
  gameId
  target        { x, y }
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
- Standard dart games (501, cricket, etc.) — this is open-ended practice
  logging only
- User accounts / multi-user support
- Editing or deleting past throws/turns/games after the fact
- Portrait orientation support

## Confirmed Decisions

1. **Ending a game**: explicit **End Game** button records `endedAt`.
2. **Zoom panel trigger**: only taps on the **full board** change which
   sector the zoom panel displays. Taps inside the zoom panel refine/log
   a point within the currently displayed wedge only — they never change
   the zoom window.
3. **Bounds**: a tap outside the board is a valid `Miss` throw (value 0),
   not ignored.
