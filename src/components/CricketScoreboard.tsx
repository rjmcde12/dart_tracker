"use client";

import { CRICKET_SEQUENCE, cricketTargetKey } from "@/lib/cricket";
import type { ThrowRecord } from "@/lib/types";
import { CricketTargetRow } from "./CricketTargetRow";

interface CricketScoreboardProps {
  throwsByTarget: Record<string, ThrowRecord[]>;
  editingKey: string | null;
  onRowClick: (key: string) => void;
}

/**
 * Live running results for the whole Cricket Practice game, shown in the
 * sidebar below the current turn's Throw Slots — same row layout as the
 * end-of-game CricketResultsModal (minus the Best column), with targets
 * whose turn hasn't happened yet shown as grayed-out placeholder circles.
 * Tapping an already-played row enters the edit-shot workflow for that turn.
 */
export function CricketScoreboard({
  throwsByTarget,
  editingKey,
  onRowClick,
}: CricketScoreboardProps) {
  return (
    <div className="flex w-56 flex-col gap-2 rounded-lg bg-zinc-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-zinc-300">Game Results</h2>
      {CRICKET_SEQUENCE.map((spec) => {
        const key = cricketTargetKey(spec);
        const throws = throwsByTarget[key];
        return (
          <CricketTargetRow
            key={key}
            spec={spec}
            throws={throws}
            isEditing={editingKey === key}
            onClick={throws ? () => onRowClick(key) : undefined}
          />
        );
      })}
    </div>
  );
}
