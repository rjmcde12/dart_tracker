import type { Point, Ring, ScoreResult } from "./types";

/**
 * Geometry reference for dartboard.svg (viewBox="-250 -250 500 500",
 * origin at the bullseye). See CLAUDE.md "Dartboard geometry reference".
 */
export const RADII = {
  boardEdge: 226,
  doubleOuter: 169.5,
  doubleInner: 160.5,
  trebleOuter: 106.5,
  trebleInner: 97.5,
  outerBullOuter: 16.4,
  innerBullOuter: 6.85,
};

/** Standard dartboard sector order, clockwise starting at the top (12 o'clock). */
export const SECTOR_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

export const SECTOR_ANGLE_DEG = 360 / SECTOR_ORDER.length;

/** Angle of a point in degrees, clockwise from straight up (0deg = up). */
export function angleDegCwFromUp(x: number, y: number): number {
  const deg = (Math.atan2(x, -y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function sectorIndexForPoint(x: number, y: number): number {
  const deg = angleDegCwFromUp(x, y);
  return Math.round(deg / SECTOR_ANGLE_DEG) % SECTOR_ORDER.length;
}

export function sectorNumberForIndex(index: number): number {
  const i = ((index % SECTOR_ORDER.length) + SECTOR_ORDER.length) % SECTOR_ORDER.length;
  return SECTOR_ORDER[i];
}

/** Center angle (deg, clockwise from up) of the given sector index. */
export function sectorCenterAngleDeg(index: number): number {
  return index * SECTOR_ANGLE_DEG;
}

export function pointToScore(x: number, y: number): ScoreResult {
  const r = Math.hypot(x, y);

  if (r <= RADII.innerBullOuter) {
    return { sector: null, ring: "INNER_BULL", label: "50", value: 50 };
  }
  if (r <= RADII.outerBullOuter) {
    return { sector: null, ring: "OUTER_BULL", label: "25", value: 25 };
  }
  if (r > RADII.boardEdge) {
    return { sector: null, ring: "MISS", label: "Miss", value: 0 };
  }

  const sector = sectorNumberForIndex(sectorIndexForPoint(x, y));

  let ring: Ring;
  let value: number;
  let label: string;

  if (r <= RADII.trebleInner) {
    ring = "SINGLE_INNER";
    value = sector;
    label = `S${sector}`;
  } else if (r <= RADII.trebleOuter) {
    ring = "TREBLE";
    value = sector * 3;
    label = `T${sector}`;
  } else if (r <= RADII.doubleInner) {
    ring = "SINGLE_OUTER";
    value = sector;
    label = `S${sector}`;
  } else if (r <= RADII.doubleOuter) {
    ring = "DOUBLE";
    value = sector * 2;
    label = `D${sector}`;
  } else {
    // Between the double ring and the board edge (number ring / wire) — no score.
    ring = "MISS";
    value = 0;
    label = "Miss";
  }

  return { sector, ring, label, value };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
