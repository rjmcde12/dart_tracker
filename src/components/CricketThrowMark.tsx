"use client";

/**
 * A single throw's result against a cricket target, shown as a small
 * circle: a green backslash for a single, a green X for a double, a green
 * circle for a triple, or a red dash for anything not on the target number
 * (wrong number or a miss). `marks: null` means that dart hasn't been
 * thrown yet — rendered as an empty, dimmed placeholder ring.
 */
export function CricketThrowMark({ marks }: { marks: number | null }) {
  const size = 28;
  const cx = size / 2;
  const cy = size / 2;

  if (marks === null) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={12} fill="none" stroke="#3f3f46" strokeWidth={1.5} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={12} fill="none" stroke="#52525b" strokeWidth={1.5} />
      {marks === 0 && (
        <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" />
      )}
      {marks === 1 && (
        <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" />
      )}
      {marks === 2 && (
        <>
          <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={cx + 6} y1={cy - 6} x2={cx - 6} y2={cy + 6} stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" />
        </>
      )}
      {marks === 3 && <circle cx={cx} cy={cy} r={7} fill="none" stroke="#22c55e" strokeWidth={2.5} />}
    </svg>
  );
}
