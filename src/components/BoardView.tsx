"use client";

import { useRef } from "react";
import type { Point } from "@/lib/types";

export interface BoardMarker {
  point: Point;
  kind: "target" | "throw";
  label?: string;
}

interface BoardViewProps {
  viewBox: string;
  rotationDeg: number;
  markers: BoardMarker[];
  onPick: (point: Point) => void;
  className?: string;
}

export function BoardView({
  viewBox,
  rotationDeg,
  markers,
  onPick,
  className,
}: BoardViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const group = groupRef.current;
    if (!svg || !group) return;

    const ctm = group.getScreenCTM();
    if (!ctm) return;

    const screenPoint = svg.createSVGPoint();
    screenPoint.x = e.clientX;
    screenPoint.y = e.clientY;
    const local = screenPoint.matrixTransform(ctm.inverse());

    onPick({ x: local.x, y: local.y });
  }

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className={className}
      onPointerDown={handlePointerDown}
      style={{ touchAction: "none" }}
    >
      <g ref={groupRef} transform={`rotate(${rotationDeg})`}>
        <image href="/dartboard.svg" x={-250} y={-250} width={500} height={500} />
        {markers.map((marker, i) => (
          <MarkerShape key={i} marker={marker} rotationDeg={rotationDeg} />
        ))}
      </g>
    </svg>
  );
}

function MarkerShape({
  marker,
  rotationDeg,
}: {
  marker: BoardMarker;
  rotationDeg: number;
}) {
  const { x, y } = marker.point;

  if (marker.kind === "target") {
    return (
      <g>
        <circle cx={x} cy={y} r={7} fill="none" stroke="#2563eb" strokeWidth={2} />
        <line x1={x - 10} y1={y} x2={x + 10} y2={y} stroke="#2563eb" strokeWidth={1.2} />
        <line x1={x} y1={y - 10} x2={x} y2={y + 10} stroke="#2563eb" strokeWidth={1.2} />
      </g>
    );
  }

  return (
    <g>
      <circle cx={x} cy={y} r={4.5} fill="#facc15" stroke="#78350f" strokeWidth={1} />
      {marker.label && (
        <text
          x={x}
          y={y}
          fontSize={11}
          fontWeight={700}
          textAnchor="middle"
          fill="#78350f"
          transform={`rotate(${-rotationDeg}, ${x}, ${y})`}
          dy={-9}
        >
          {marker.label}
        </text>
      )}
    </g>
  );
}
