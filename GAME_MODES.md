# Game Modes

Catalog of Dart Practice Tracker's game modes. Each mode reuses the shared
architecture described in [CLAUDE.md](./CLAUDE.md) (board UI, coordinate
system, scoring geometry, Throw Slots, IndexedDB persistence) but drives
Target placement and turn progression differently. New modes should be
added here as their own section.

Tapping **New Game** opens a modal to pick a mode. Some modes ask a
follow-up question before starting (e.g. Cricket Practice asks for a
Target variant).

## Free Play

The original/default mode — open-ended practice with no fixed sequence.

- User manually sets every Target by tapping the board (Set Target →
  Confirm Target, see CLAUDE.md Core Workflow). The **Confirm Target**
  button lives in the Throw Slots panel, in the same spot **End Turn**
  later occupies.
- Target persists across turns until **Move Target** is tapped.
- No automatic end condition — the session runs until **End Game** is
  tapped manually.
- No results modal; a full history view is a future iteration, but see
  "Recent Turns panel" below for what's shown live during the session.

`Game.mode = "free-play"`, `Game.cricketVariant = null`, and every
`Turn.cricketTarget = null`.

### Recent Turns panel

Below the Throw Slots, Free Play shows the **last 5 completed turns**
(most recent on top), each row:

- **Target label** — the Target's dartboard number (or "Bull"), ignoring
  which ring it's in: a Target placed anywhere in the "20" wedge (single,
  treble, wherever) is just labeled "20" for now. Computed by
  `nearestNumberOrBullLabel` (`src/lib/dartboard.ts`). Once richer
  historical tracking is added, this can be refined to the specific
  region (e.g. "T20" vs "single outer 20").
- **Per-dart results** — each of the 3 throws' score label (e.g. `T20`,
  `S17`, `Miss`), reusing the same labels already shown live in the Throw
  Slots panel.
- **Turn total** — sum of the 3 throws' point values.

This is `FreePlayHistory` (`src/components/FreePlayHistory.tsx`), backed
by an in-memory list capped at 5 entries — it isn't a DB query, just the
last few turns kept in React state for the current session.

## Cricket Practice

Drills the 6 cricket numbers (20 → 15) plus the bull, one turn each, fully
automatically — no manual Target selection.

### Setup

After picking **Cricket Practice** in the New Game modal, a second choice
appears — **Target: Single or Triple** — which sets where every numbered
Target (not the bull) is placed for the whole game:

- **Single**: the Target is placed in the middle of the larger outer
  single section (the ring between the treble ring and the double ring —
  radius = midpoint of `RADII.trebleOuter` and `RADII.doubleInner`).
- **Triple**: the Target is placed in the center of the treble ring
  (radius = midpoint of `RADII.trebleInner` and `RADII.trebleOuter`).

In both cases the angle is that number's sector center angle — see
`sectorCenterAngleDeg` / `sectorIndexForNumber` in `dartboard.ts`.

### Turn sequence

Exactly one turn (3 darts) per target, in this fixed order:

```
20 → 19 → 18 → 17 → 16 → 15 → Bull
```

- The **first** Target (20) is placed and the game enters the throwing
  phase immediately — there is no Set Target/Confirm Target step at all
  in this mode.
- Tapping **End Turn** records that turn's tally (see below) and
  auto-advances: the next number in the sequence becomes the new Target,
  placed automatically per the Single/Triple variant, and a new turn
  starts right away (still no manual confirm step).
- **Bull** is always the final target regardless of the Single/Triple
  choice — there's no "single vs. triple" distinction for the bull.
  Its Target is placed dead center `(0, 0)`.
- **Move Target** is not available in this mode (there's nothing to move
  — the sequence controls Target placement).
- Ending the **Bull** turn (tapping End Turn) automatically ends the
  game (`Game.endedAt` set) and opens the results modal — no manual End
  Game tap is needed to finish a completed sequence. (Manual End Game
  still works at any point to bail out early, in which case no results
  modal is shown.)

### Tallies (not points)

Cricket Practice tracks **tallies**, not scoring points. For the turn
targeting a given number, each of its 3 throws contributes:

| Where it landed | Marks |
|---|---|
| Single (inner or outer) **of the target number** | 1 |
| Double **of the target number** | 2 |
| Treble **of the target number** | 3 |
| Any other number's sector, or a Miss | 0 |

For the Bull turn specifically:

| Where it landed | Marks |
|---|---|
| Outer bull (25) | 1 |
| Inner bull (50) | 2 |
| Anything else (Miss) | 0 |

Example: a turn's 3 darts land on single-20, treble-20, and a miss →
1 + 3 + 0 = **4 tallies** for 20. Implemented in `cricketMarksForThrow`
(`src/lib/cricket.ts`).

### Live scoreboard

Below the Throw Slots, Cricket Practice shows a running **Game Results**
panel — every target in the sequence (20, 19, 18, 17, 16, 15, Bull), each
as a row of the target label + 3 per-dart result circles + a running
total. It's the same row layout as the end-of-game results modal (see
below), minus the Best column. A target whose turn hasn't happened yet
shows 3 empty, dimmed placeholder circles and a `–` instead of a total —
it updates to real marks only once that turn's End Turn is tapped (the
turn currently being thrown stays in its "not yet played" state here
even though its darts are already visible above in the Throw Slots).

Each per-dart circle (`CricketThrowMark` component) shows that single
throw's result against the target:

- **Miss** (wrong number, or a true miss) → a red dash
- **Single** → a green backslash
- **Double** → a green X
- **Treble** → a green circle
- **Not thrown yet** → an empty, dimmed circle (no mark)

### Results modal

Once the Bull turn ends, a modal shows the same per-target rows as the
live scoreboard, plus a **Best** column — the highest tally ever recorded
for that target across *all* past Cricket Practice games (queried from
IndexedDB via `getAllTurns`/`getThrowsForTurn`, filtered by matching
`cricketTarget`, computed with `cricketTallyForTurn`; see
`computeCricketBestTallies` in `page.tsx`). Best is computed once, right
after the game ends, and includes the just-finished game's own turns.

Two buttons at the bottom:

- **Restart Game** — immediately starts a new Cricket Practice game with
  the same Target variant (Single/Triple), skipping the New Game modal
  entirely.
- **Change Game Type** — re-opens the New Game modal (mode picker), same
  as tapping the header's New Game button.

### Data model notes

- `Game.mode = "cricket-practice"`, `Game.cricketVariant = "single" | "triple"`.
- `Turn.cricketTarget = { kind: "number", number: 20 }` (etc.) or
  `{ kind: "bull" }` — records which sequence step a turn was for. This is
  what makes the Best-ever lookup possible: it's how a past Turn is
  matched back to "which target was this for" without re-deriving it from
  the Turn's raw `target` coordinates.
- Tallies themselves (both the live scoreboard's and the results modal's
  Total column) are computed on the fly from each turn's raw Throw data
  via `cricketTallyForTurn`; they aren't written as a separate DB record.

## Adding a new mode

When adding another mode:

1. Give it a `GameMode` value in `src/lib/types.ts`.
2. If it needs its own setup question(s) (like Cricket's Single/Triple),
   extend `NewGameModal`.
3. Put its target-sequencing/scoring rules in its own `src/lib/<mode>.ts`
   file, mirroring `cricket.ts`.
4. Document it in its own section here, following the same shape:
   setup → turn/target progression → scoring/marking rules → end
   condition → results display (if any).
