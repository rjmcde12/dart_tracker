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
}

export function CricketTargetRow({ spec, throws, best }: CricketTargetRowProps) {
  const played = throws !== undefined;
  const total = played ? cricketTallyForTurn(throws, spec) : null;

  return (
    <div className="flex items-center gap-3 border-b border-zinc-800 pb-2">
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
    </div>
  );
}
