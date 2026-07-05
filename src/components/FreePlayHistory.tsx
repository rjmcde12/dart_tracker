"use client";

import { nearestNumberOrBullLabel } from "@/lib/dartboard";
import type { ThrowRecord, Turn } from "@/lib/types";

export interface FreePlayTurnSummary {
  turn: Turn;
  throws: ThrowRecord[];
}

interface FreePlayHistoryProps {
  history: FreePlayTurnSummary[];
  editingTurnId: string | null;
  onRowClick: (index: number) => void;
}

/**
 * The last 5 completed Free Play turns, most recent first — same row shape
 * as the Cricket scoreboard (target label + per-dart results + total), but
 * since a Free Play Target isn't a fixed sequence of numbers, this shows
 * history instead of upcoming/remaining targets. Tapping a row enters the
 * edit-shot workflow for that turn.
 */
export function FreePlayHistory({ history, editingTurnId, onRowClick }: FreePlayHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="flex w-56 flex-col gap-2 rounded-lg bg-zinc-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-zinc-300">Recent Turns</h2>
      {history.map((summary, i) => {
        const total = summary.throws.reduce((sum, t) => sum + t.score.value, 0);
        const isEditing = editingTurnId === summary.turn.id;
        return (
          <button
            key={summary.turn.id}
            type="button"
            onClick={() => onRowClick(i)}
            className={`flex items-center gap-2 border-b pb-2 text-left text-sm transition-colors ${
              isEditing ? "border-blue-500" : "border-zinc-800 hover:border-zinc-600"
            }`}
          >
            <span className="w-8 font-semibold text-zinc-300">
              {nearestNumberOrBullLabel(summary.turn.target)}
            </span>
            <span className="flex-1 text-zinc-400">
              {summary.throws.map((t) => t.score.label).join(", ")}
            </span>
            <span className="w-10 text-right font-semibold text-zinc-100">{total}</span>
          </button>
        );
      })}
    </div>
  );
}
