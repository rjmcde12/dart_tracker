"use client";

import { nearestNumberOrBullLabel } from "@/lib/dartboard";
import type { Point, ThrowRecord } from "@/lib/types";

export interface FreePlayTurnSummary {
  target: Point;
  throws: ThrowRecord[];
}

interface FreePlayHistoryProps {
  history: FreePlayTurnSummary[];
}

/**
 * The last 5 completed Free Play turns, most recent first — same row shape
 * as the Cricket scoreboard (target label + per-dart results + total), but
 * since a Free Play Target isn't a fixed sequence of numbers, this shows
 * history instead of upcoming/remaining targets.
 */
export function FreePlayHistory({ history }: FreePlayHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="flex w-56 flex-col gap-2 rounded-lg bg-zinc-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-zinc-300">Recent Turns</h2>
      {history.map((turn, i) => {
        const total = turn.throws.reduce((sum, t) => sum + t.score.value, 0);
        return (
          <div
            key={i}
            className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-sm"
          >
            <span className="w-8 font-semibold text-zinc-300">
              {nearestNumberOrBullLabel(turn.target)}
            </span>
            <span className="flex-1 text-zinc-400">
              {turn.throws.map((t) => t.score.label).join(", ")}
            </span>
            <span className="w-10 text-right font-semibold text-zinc-100">{total}</span>
          </div>
        );
      })}
    </div>
  );
}
