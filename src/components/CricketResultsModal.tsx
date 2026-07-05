"use client";

import { CRICKET_SEQUENCE, cricketTargetKey } from "@/lib/cricket";
import type { ThrowRecord } from "@/lib/types";
import { CricketTargetRow } from "./CricketTargetRow";

interface CricketResultsModalProps {
  throwsByTarget: Record<string, ThrowRecord[]>;
  best: Record<string, number>;
  onRestartGame: () => void;
  onChangeGameType: () => void;
}

export function CricketResultsModal({
  throwsByTarget,
  best,
  onRestartGame,
  onChangeGameType,
}: CricketResultsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[28rem] rounded-lg bg-zinc-900 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Cricket Practice Results</h2>

        <div className="mb-1 flex items-center gap-3 px-1 text-xs font-semibold text-zinc-500">
          <span className="w-10" />
          <span className="flex-1" />
          <span className="w-12 text-right">Total</span>
          <span className="w-12 text-right">Best</span>
        </div>

        <div className="flex flex-col gap-2">
          {CRICKET_SEQUENCE.map((spec) => {
            const key = cricketTargetKey(spec);
            return (
              <CricketTargetRow
                key={key}
                spec={spec}
                throws={throwsByTarget[key]}
                best={best[key] ?? 0}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRestartGame}
          className="mt-6 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500"
        >
          Restart Game
        </button>
        <button
          type="button"
          onClick={onChangeGameType}
          className="mt-2 w-full rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
        >
          Change Game Type
        </button>
      </div>
    </div>
  );
}
