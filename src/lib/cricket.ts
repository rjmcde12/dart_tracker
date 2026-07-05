import { RADII, sectorCenterAngleDeg, sectorIndexForNumber } from "./dartboard";
import type {
  CricketTargetSpec,
  CricketVariant,
  Point,
  ScoreResult,
  ThrowRecord,
} from "./types";

/** Cricket Practice targets numbers 20 down to 15, then the bull, one turn each. */
export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15];

export const CRICKET_SEQUENCE: CricketTargetSpec[] = [
  ...CRICKET_NUMBERS.map((number) => ({ kind: "number", number }) as const),
  { kind: "bull" } as const,
];

export function cricketTargetKey(spec: CricketTargetSpec): string {
  return spec.kind === "bull" ? "bull" : String(spec.number);
}

export function cricketTargetLabel(spec: CricketTargetSpec): string {
  return spec.kind === "bull" ? "Bull" : String(spec.number);
}

/**
 * Where the auto-placed Target sits for a given cricket target: dead center
 * for the bull, otherwise the middle of the single-outer ring (the larger
 * outer section) or the treble ring, per the chosen Cricket Variant.
 */
export function cricketTargetPoint(spec: CricketTargetSpec, variant: CricketVariant): Point {
  if (spec.kind === "bull") return { x: 0, y: 0 };

  const angleDeg = sectorCenterAngleDeg(sectorIndexForNumber(spec.number));
  const angleRad = (angleDeg * Math.PI) / 180;
  const radius =
    variant === "single"
      ? (RADII.trebleOuter + RADII.doubleInner) / 2
      : (RADII.trebleInner + RADII.trebleOuter) / 2;

  return { x: radius * Math.sin(angleRad), y: -radius * Math.cos(angleRad) };
}

/**
 * Cricket marks earned by a single throw against a given target: 1 for a
 * single, 2 for a double, 3 for a treble — but only when the throw actually
 * landed in that target's sector (or, for the bull, in the bull at all).
 * Everything else (wrong number, miss) is worth 0.
 */
export function cricketMarksForThrow(score: ScoreResult, spec: CricketTargetSpec): number {
  if (spec.kind === "bull") {
    if (score.ring === "OUTER_BULL") return 1;
    if (score.ring === "INNER_BULL") return 2;
    return 0;
  }

  if (score.sector !== spec.number) return 0;

  switch (score.ring) {
    case "SINGLE_INNER":
    case "SINGLE_OUTER":
      return 1;
    case "DOUBLE":
      return 2;
    case "TREBLE":
      return 3;
    default:
      return 0;
  }
}

/** Total marks across a turn's throws (usually 3) against a given target. */
export function cricketTallyForTurn(throws: ThrowRecord[], spec: CricketTargetSpec): number {
  return throws.reduce((sum, t) => sum + cricketMarksForThrow(t.score, spec), 0);
}
