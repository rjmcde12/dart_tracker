export interface Point {
  x: number;
  y: number;
}

export type Ring =
  | "DOUBLE"
  | "TREBLE"
  | "SINGLE_INNER"
  | "SINGLE_OUTER"
  | "OUTER_BULL"
  | "INNER_BULL"
  | "MISS";

export interface ScoreResult {
  sector: number | null;
  ring: Ring;
  label: string;
  value: number;
}

export interface Game {
  id: string;
  startedAt: number;
  endedAt: number | null;
}

export interface Turn {
  id: string;
  gameId: string;
  turnNumber: number;
  target: Point;
  createdAt: number;
}

export type ThrowSuffix = "a" | "b" | "c";

export interface ThrowRecord {
  id: string;
  turnId: string;
  gameId: string;
  suffix: ThrowSuffix;
  position: Point;
  score: ScoreResult;
  distanceFromTarget: number;
  createdAt: number;
}
