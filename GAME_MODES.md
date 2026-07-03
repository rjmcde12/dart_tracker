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
  Confirm Target, see CLAUDE.md Core Workflow).
- Target persists across turns until **Move Target** is tapped.
- No automatic end condition — the session runs until **End Game** is
  tapped manually.
- No results modal; progress is only reflected live in the Throw Slots
  panel and (in a future iteration) a history view.

`Game.mode = "free-play"`, `Game.cricketVariant = null`, and every
`Turn.cricketTarget = null`.

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

### Results modal

Once the Bull turn ends, a modal shows the tally count for each of 20,
19, 18, 17, 16, 15, and Bull, rendered in classic cricket-scorecard marks
(`CricketTallyMark` component):

1. 1st mark → one diagonal slash
2. 2nd mark → the other diagonal, completing an X
3. 3rd mark → a circle around the X ("closed")
4. 4th+ marks → plain tally lines added to the right of the circled X

A **New Game** button at the bottom of the results modal re-opens the
New Game mode picker.

### Data model notes

- `Game.mode = "cricket-practice"`, `Game.cricketVariant = "single" | "triple"`.
- `Turn.cricketTarget = { kind: "number", number: 20 }` (etc.) or
  `{ kind: "bull" }` — records which sequence step a turn was for, so
  tallies could be recomputed later from raw Throw data if needed.
- Tallies themselves are computed in memory during play and shown in the
  results modal; they aren't written as a separate DB record (the raw
  Turn/Throw data plus `cricketTarget` is enough to derive them again).

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
