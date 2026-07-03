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

export type GameMode = "free-play" | "cricket-practice";
export type CricketVariant = "single" | "triple";

/** What a cricket turn's target represents: a specific number, or the bull. */
export type CricketTargetSpec =
  | { kind: "number"; number: number }
  | { kind: "bull" };

export interface Game {
  id: string;
  mode: GameMode;
  cricketVariant: CricketVariant | null;
  startedAt: number;
  endedAt: number | null;
}

export interface Turn {
  id: string;
  gameId: string;
  turnNumber: number;
  target: Point;
  /** Set only for cricket-practice turns; identifies which number/bull this turn is for. */
  cricketTarget: CricketTargetSpec | null;
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
