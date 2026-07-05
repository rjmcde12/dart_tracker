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
  for the single board panel in both its full-board and zoomed-crop
  states. `viewBox="-250 -250 500 500"`, centered on the bullseye at
  `(0,0)`.
- `layout.pdf` — original UI mockup (full board + a separate zoomed wedge
  view); superseded by the single-panel design below, kept for history.

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
- The UI maps pointer/tap events on the board panel back into this same
  `(x, y)` space before storing, regardless of whether the panel is
  currently showing the full board or a zoomed crop — a throw logged
  while zoomed in and one logged on the full board are stored identically
  (`BoardView`'s `getScreenCTM()`-based mapping just adapts to whatever
  `viewBox` is currently active).

## UI Layout

**One large board panel**, plus the Throw Slots sidebar:

1. **Board panel**: the complete `dartboard.svg`, shown either as the
   full board or zoomed into the current Target — see "Board Zoom"
   below for exactly which and when.
2. **Throw Slots** (sidebar): three slots (Dart 1 / 2 / 3) for the
   current turn. See "Throw Slots & Editing" below.

### Board Zoom

The single board panel shows the **full board** whenever there's no
Target to zoom to (idle, or Free Play before the first tap of Set
Target). As soon as a Target exists — pending, confirmed, or one being
edited (see "Editing a past turn") — it zooms into that Target's area,
recomputed fresh any time the relevant Target changes. There's no
separate "zoom state" to track: the crop is a pure function of whichever
Target is currently relevant (`boardCropViewBox` in `dartboard.ts`).

Rules the zoom crop always follows:

- **No rotation, ever.** The board is never rotated to make a wedge
  point in any particular direction — it zooms in place, so the printed
  numbers are always in their normal, correctly-oriented position. (This
  replaced an earlier design that rotated the crop and masked/redrew the
  number labels to compensate — no longer needed now that nothing
  rotates.)
- **The full wedge is always shown.** For a Target in a numbered sector,
  the crop is fit tightly around that sector's entire 18° wedge from the
  bull outward — both straight edges and the outer arc — regardless of
  which of the 20 possible directions the wedge points. Since a
  non-rotating crop's bounding shape is different for every orientation
  (a wedge pointing straight up needs a tall crop, one pointing sideways
  needs a wide one, a diagonal one needs something in between,
  potentially bulging further at any cardinal direction — 0/90/180/270°
  — the wedge's outer arc happens to cross), this is computed by
  sampling the wedge's outline rather than a single formula — see
  `wedgeViewBox` in `dartboard.ts`.
- **The full bullseye is always visible**, since the wedge's inner point
  is the bull itself.
- **Some area beyond the double ring is included** (`WEDGE_CONTEXT_RADIUS
  = 250`, vs. the board edge at 226), so a near-miss throw just outside
  the wire is still visible and taggable rather than clipped off.
- **Adjacent sectors' number labels are clearly shown.** The crop's
  angular span is wider than the target sector's own 18° — reaching
  `SECTOR_ANGLE_DEG + 5` degrees past center on each side (past the
  neighboring sectors' own center lines) — so both neighboring numbers
  are legible for orientation/context.
- A Target within the outer bull radius uses a separate square crop
  (`BULL_VIEW_BOX`) centered on the bull, reaching to just inside the
  treble ring — there's no single wedge to fit around a bull Target.

### Full Board toggle

Because the zoomed crop is tightly fit to one Target's wedge, a wild
throw that lands well outside it can't be tapped directly — there's
nothing else on screen to click. A **Full Board** button (footer,
whenever a Target exists) temporarily shows the whole board instead;
tapping anywhere on it (to log a throw, refine a pending Target, or
adjust an armed dart during past-turn editing) automatically reverts
back to the zoomed crop afterward. The button's label reflects the
current state (`Full Board` / `Zoomed View`) and it can also be tapped
again manually to switch back without making a tap first.

## Core Workflow

1. **New Game** — opens a modal to choose a Game Mode (Free Play, Cricket
   Practice, ...). See [GAME_MODES.md](./GAME_MODES.md) for what each mode
   asks next (e.g. Cricket Practice then asks for a Target variant) and
   how it drives Target placement. Choosing a mode creates the Game record
   (id + mode + start timestamp) and begins the session.
2. **Set Target** — *(Free Play only — other modes place the Target
   automatically; see GAME_MODES.md)*. User taps a point on the (initially
   full) board panel, which then zooms into that sector — see "Board
   Zoom" above. Tapping again (in the now-zoomed view, or via the Full
   Board toggle for a bigger change of mind) refines/replaces the pending
   Target position, and the crop re-fits itself each time.
3. **Confirm Target** — *(Free Play only)*. Button in the Throw Slots
   panel (see below). Locks in the Target position for the upcoming
   turn(s).
4. **Log Throws** — user throws 3 real darts, then taps where each landed
   on the board panel — 3 Throw Result points collected per turn,
   populating the Throw Slots on the right as they're logged. A throw
   close to the Target is easy to tap precisely in the zoomed crop; a
   wild throw needs the Full Board toggle first (see above).
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
Model below) sit to the right of the board panel:

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
   turn's 3 darts instead (with a header naming which turn), and the
   board panel shows that turn's Target and darts, zoomed to its Target's
   wedge.
2. Tapping one of the 3 slots arms it; the next tap on the board panel
   (zoomed or, via the Full Board toggle, the whole board) overwrites
   that dart's position (recomputing its score, distance, and — for
   Cricket — its marks), then disarms automatically. Repeat for any other
   dart in that turn that needs fixing.
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
2. **Single board panel, no rotation**: replaced the original two-panel
   (full board + rotated zoom wedge) design — see "Board Zoom" above. The
   crop is always a pure function of the current Target, never rotated,
   and a Full Board toggle handles wild throws that land outside it.
3. **Bounds**: a tap outside the board is a valid `Miss` throw (value 0),
   not ignored.
4. **Auto-end turn**: a turn ends the instant its 3rd dart is logged —
   no End Turn button. To fix a mistake, tap that turn's row in the
   Cricket scoreboard / Free Play Recent Turns panel, which arms the
   same slot-click-then-board-tap editing flow that used to live in the
   Throw Slots panel, now scoped to whichever past turn was tapped.
