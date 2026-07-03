"use client";

/**
 * Classic cricket-scorecard marks: 1st hit draws one diagonal slash, 2nd hit
 * completes the X, 3rd hit circles the X ("closed"), and any further hits
 * are drawn as simple tally lines to the right.
 */
export function CricketTallyMark({ count }: { count: number }) {
  const extra = Math.max(0, count - 3);
  const width = 32 + extra * 10;

  return (
    <svg width={width} height={28} viewBox={`0 0 ${width} 28`} className="text-current">
      {count >= 1 && (
        <line x1={4} y1={4} x2={24} y2={24} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      )}
      {count >= 2 && (
        <line x1={24} y1={4} x2={4} y2={24} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      )}
      {count >= 3 && (
        <circle cx={14} cy={14} r={12} fill="none" stroke="currentColor" strokeWidth={2.5} />
      )}
      {Array.from({ length: extra }).map((_, i) => (
        <line
          key={i}
          x1={32 + i * 10}
          y1={4}
          x2={32 + i * 10}
          y2={24}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
