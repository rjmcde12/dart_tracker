"use client";

import { CRICKET_SEQUENCE, cricketTargetKey, cricketTargetLabel } from "@/lib/cricket";
import { CricketTallyMark } from "./CricketTallyMark";

interface CricketResultsModalProps {
  tallies: Record<string, number>;
  onNewGame: () => void;
}

export function CricketResultsModal({ tallies, onNewGame }: CricketResultsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-96 rounded-lg bg-zinc-900 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Cricket Practice Results</h2>
        <div className="flex flex-col gap-2">
          {CRICKET_SEQUENCE.map((spec) => {
            const key = cricketTargetKey(spec);
            const count = tallies[key] ?? 0;
            return (
              <div
                key={key}
                className="flex items-center justify-between border-b border-zinc-800 pb-2"
              >
                <span className="w-12 text-sm font-semibold text-zinc-300">
                  {cricketTargetLabel(spec)}
                </span>
                <span className="text-zinc-100">
                  <CricketTallyMark count={count} />
                </span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onNewGame}
          className="mt-6 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
