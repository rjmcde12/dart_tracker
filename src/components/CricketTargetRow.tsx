"use client";

import { cricketTallyForTurn, cricketTargetLabel } from "@/lib/cricket";
import type { CricketTargetSpec, ThrowRecord } from "@/lib/types";
import { CricketThrowMark } from "./CricketThrowMark";

interface CricketTargetRowProps {
  spec: CricketTargetSpec;
  /** This target's throws so far, or undefined if its turn hasn't happened yet. */
  throws: ThrowRecord[] | undefined;
  /** Pass to render a trailing "Best ever" column; omit to leave it out. */
  best?: number;
  /** Highlights the row as the one currently open for editing. */
  isEditing?: boolean;
  /** Pass to make a played row clickable (enters/exits editing that turn). */
  onClick?: () => void;
}

export function CricketTargetRow({
  spec,
  throws,
  best,
  isEditing,
  onClick,
}: CricketTargetRowProps) {
  const played = throws !== undefined;
  const total = played ? cricketTallyForTurn(throws, spec) : null;

  const rowContent = (
    <>
      <span className="w-10 text-sm font-semibold text-zinc-300">
        {cricketTargetLabel(spec)}
      </span>
      <span className="flex flex-1 gap-2">
        {[0, 1, 2].map((i) => (
          <CricketThrowMark
            key={i}
            marks={played && throws[i] ? cricketTallyForTurn([throws[i]], spec) : null}
          />
        ))}
      </span>
      <span className="w-12 text-right text-sm font-semibold text-zinc-100">
        {total ?? "–"}
      </span>
      {best !== undefined && (
        <span className="w-12 text-right text-sm text-zinc-400">{best}</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 border-b pb-2 text-left transition-colors ${
          isEditing ? "border-blue-500" : "border-zinc-800 hover:border-zinc-600"
        }`}
      >
        {rowContent}
      </button>
    );
  }

  return <div className="flex items-center gap-3 border-b border-zinc-800 pb-2">{rowContent}</div>;
}
