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

export function sectorIndexForNumber(number: number): number {
  const index = SECTOR_ORDER.indexOf(number);
  if (index === -1) throw new Error(`${number} is not a valid dartboard number`);
  return index;
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

/**
 * A point's dartboard number, ignoring which ring it's in (so a Free Play
 * Target set anywhere in the "20" wedge — single, treble, whatever — is
 * just "20"), or "Bull" if it's within the outer bull radius. A coarser,
 * display-only sibling of `pointToScore`; see CLAUDE.md for why Free Play
 * only tracks the plain number for now.
 */
export function nearestNumberOrBullLabel(point: Point): string {
  const r = Math.hypot(point.x, point.y);
  if (r <= RADII.outerBullOuter) return "Bull";
  return String(sectorNumberForIndex(sectorIndexForPoint(point.x, point.y)));
}

export const FULL_BOARD_VIEW_BOX = "-250 -250 500 500";
// Square crop for a Target in/near the bull, reaching to just inside the treble ring.
export const BULL_VIEW_BOX = "-110 -110 220 220";

// How far past a sector's own 18° width the crop extends on each side —
// past the SECTOR_ANGLE_DEG (18) needed to reach the adjacent sectors'
// center lines, plus a few more degrees so their number labels aren't
// cut off right at the edge.
const WEDGE_HALF_ANGLE_DEG = SECTOR_ANGLE_DEG + 5;
// Radius the crop reaches out to — beyond the board edge (226), so a
// near-miss throw just outside the wire is still visible and taggable.
const WEDGE_CONTEXT_RADIUS = 250;
const WEDGE_PADDING = 16;

function polarToWorld(radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) };
}

function angleWithinRange(angleDeg: number, loDeg: number, hiDeg: number): boolean {
  const norm = (a: number) => ((a % 360) + 360) % 360;
  const a = norm(angleDeg);
  const lo = norm(loDeg);
  const hi = norm(hiDeg);
  return lo <= hi ? a >= lo && a <= hi : a >= lo || a <= hi;
}

/**
 * A viewBox tightly fit around one sector's full wedge (from the bull out
 * past the board edge), with no rotation, sized to also reveal the
 * neighboring sectors' number labels for context. Computed by sampling the
 * wedge's outline (its two straight radial edges' outer corners, the bull,
 * and — where the outer arc crosses a cardinal direction within the wedge's
 * angular span — that bulge point too) rather than a closed-form formula,
 * since the bounding box shape differs for each of the 20 possible
 * orientations.
 */
export function wedgeViewBox(index: number): string {
  const centerAngle = sectorCenterAngleDeg(index);
  const loAngle = centerAngle - WEDGE_HALF_ANGLE_DEG;
  const hiAngle = centerAngle + WEDGE_HALF_ANGLE_DEG;

  const sampleAngles = [loAngle, hiAngle];
  for (const cardinal of [0, 90, 180, 270]) {
    if (angleWithinRange(cardinal, loAngle, hiAngle)) sampleAngles.push(cardinal);
  }

  const points = [
    { x: 0, y: 0 },
    ...sampleAngles.map((a) => polarToWorld(WEDGE_CONTEXT_RADIUS, a)),
  ];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const minX = Math.min(...xs) - WEDGE_PADDING;
  const maxX = Math.max(...xs) + WEDGE_PADDING;
  const minY = Math.min(...ys) - WEDGE_PADDING;
  const maxY = Math.max(...ys) + WEDGE_PADDING;

  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
}

/** The single board panel's viewBox for a given Target (or the full board if none). */
export function boardCropViewBox(target: Point | null): string {
  if (!target) return FULL_BOARD_VIEW_BOX;
  const r = Math.hypot(target.x, target.y);
  if (r <= RADII.outerBullOuter) return BULL_VIEW_BOX;
  return wedgeViewBox(sectorIndexForPoint(target.x, target.y));
}
