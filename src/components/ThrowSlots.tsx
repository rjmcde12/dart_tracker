"use client";

import type { ThrowRecord, ThrowSuffix } from "@/lib/types";

const SUFFIXES: ThrowSuffix[] = ["a", "b", "c"];

interface ThrowSlotsProps {
  throws: ThrowRecord[];
  editable: boolean;
  editingIndex: number | null;
  onSlotClick: (index: number) => void;
  canEndTurn: boolean;
  onEndTurn: () => void;
  canConfirmTarget: boolean;
  onConfirmTarget: () => void;
}

export function ThrowSlots({
  throws,
  editable,
  editingIndex,
  onSlotClick,
  canEndTurn,
  onEndTurn,
  canConfirmTarget,
  onConfirmTarget,
}: ThrowSlotsProps) {
  const total = throws.reduce((sum, t) => sum + t.score.value, 0);

  return (
    <div className="flex w-56 flex-col gap-3 rounded-lg bg-zinc-900 p-4">
      {SUFFIXES.map((suffix, index) => {
        const t = throws[index];
        const isEditing = editingIndex === index;
        const clickable = editable;

        return (
          <button
            key={suffix}
            type="button"
            disabled={!clickable}
            onClick={() => onSlotClick(index)}
            className={`flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors ${
              isEditing
                ? "border-blue-500 bg-blue-950"
                : "border-zinc-700 bg-zinc-800"
            } ${clickable ? "cursor-pointer hover:border-blue-500" : "cursor-default"}`}
          >
            <span className="text-xs font-semibold text-yellow-400">
              Dart {index + 1}
            </span>
            {t ? (
              <span className="text-sm text-zinc-100">
                {t.score.label} ({t.score.value}) — {t.distanceFromTarget.toFixed(1)} units
              </span>
            ) : (
              <span className="text-sm text-zinc-500">Not thrown</span>
            )}
            {isEditing && (
              <span className="text-xs text-blue-400">Tap a board to adjust…</span>
            )}
          </button>
        );
      })}

      {throws.length === 3 && (
        <div className="mt-1 border-t border-zinc-700 pt-3 text-sm font-semibold text-zinc-100">
          Turn total: {total}
        </div>
      )}

      {canConfirmTarget && (
        <button
          type="button"
          onClick={onConfirmTarget}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Confirm Target
        </button>
      )}

      {canEndTurn && (
        <button
          type="button"
          onClick={onEndTurn}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          End Turn?
        </button>
      )}
    </div>
  );
}
