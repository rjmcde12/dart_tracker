"use client";

import { useMemo, useState } from "react";
import { BoardView, type BoardMarker } from "@/components/BoardView";
import { createGame, createTurn, addThrow, endGame } from "@/lib/db";
import { sectorCenterAngleDeg, sectorIndexForPoint } from "@/lib/dartboard";
import type { Game, Point, Turn, ThrowRecord } from "@/lib/types";

const FULL_VIEW_BOX = "-250 -250 500 500";
const ZOOM_VIEW_BOX = "-45 -232 90 252";

type Phase = "idle" | "setting-target" | "throwing";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [game, setGame] = useState<Game | null>(null);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turnNumber, setTurnNumber] = useState(0);

  const [zoomSectorIndex, setZoomSectorIndex] = useState(0);
  const [pendingTarget, setPendingTarget] = useState<Point | null>(null);
  const [confirmedTarget, setConfirmedTarget] = useState<Point | null>(null);
  const [currentThrows, setCurrentThrows] = useState<ThrowRecord[]>([]);

  const zoomRotationDeg = -sectorCenterAngleDeg(zoomSectorIndex);

  const activeTargetPoint =
    phase === "setting-target" ? pendingTarget : confirmedTarget;

  const markers: BoardMarker[] = useMemo(() => {
    const list: BoardMarker[] = [];
    if (activeTargetPoint) {
      list.push({ point: activeTargetPoint, kind: "target" });
    }
    for (const t of currentThrows) {
      list.push({ point: t.position, kind: "throw", label: t.suffix });
    }
    return list;
  }, [activeTargetPoint, currentThrows]);

  async function handleStartGame() {
    const newGame = await createGame();
    setGame(newGame);
    setTurn(null);
    setTurnNumber(0);
    setCurrentThrows([]);
    setPendingTarget(null);
    setConfirmedTarget(null);
    setPhase("setting-target");
  }

  function handleFullBoardPick(point: Point) {
    setZoomSectorIndex(sectorIndexForPoint(point.x, point.y));
    handlePick(point);
  }

  function handleZoomPick(point: Point) {
    handlePick(point);
  }

  function handlePick(point: Point) {
    if (phase === "setting-target") {
      setPendingTarget(point);
    } else if (phase === "throwing") {
      void logThrow(point);
    }
  }

  async function logThrow(point: Point) {
    if (!turn || currentThrows.length >= 3) return;
    const suffix = (["a", "b", "c"] as const)[currentThrows.length];
    const throwRecord = await addThrow(turn, suffix, point);
    setCurrentThrows((prev) => [...prev, throwRecord]);
  }

  async function handleConfirmTarget() {
    if (!game || !pendingTarget) return;
    const nextTurnNumber = turnNumber + 1;
    const newTurn = await createTurn(game.id, nextTurnNumber, pendingTarget);
    setTurn(newTurn);
    setTurnNumber(nextTurnNumber);
    setConfirmedTarget(pendingTarget);
    setPendingTarget(null);
    setCurrentThrows([]);
    setPhase("throwing");
  }

  async function handleEndTurn() {
    if (!game || !confirmedTarget) return;
    const nextTurnNumber = turnNumber + 1;
    const newTurn = await createTurn(game.id, nextTurnNumber, confirmedTarget);
    setTurn(newTurn);
    setTurnNumber(nextTurnNumber);
    setCurrentThrows([]);
  }

  function handleMoveTarget() {
    setPendingTarget(confirmedTarget);
    setConfirmedTarget(null);
    setTurn(null);
    setPhase("setting-target");
  }

  async function handleEndGame() {
    if (!game) return;
    await endGame(game.id);
    setGame(null);
    setTurn(null);
    setTurnNumber(0);
    setCurrentThrows([]);
    setPendingTarget(null);
    setConfirmedTarget(null);
    setPhase("idle");
  }

  const canConfirmTarget = phase === "setting-target" && pendingTarget !== null;
  const canMoveTarget = phase === "throwing" && currentThrows.length === 0;
  const canEndTurn = phase === "throwing" && currentThrows.length === 3;

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Dart Practice Tracker</h1>
          <p className="text-sm text-zinc-400">{statusLine(phase, turnNumber, currentThrows.length)}</p>
        </div>
        <div className="flex gap-2">
          {phase === "idle" && (
            <Button onClick={handleStartGame}>Start Game</Button>
          )}
          {phase !== "idle" && (
            <Button variant="danger" onClick={handleEndGame}>
              End Game
            </Button>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-stretch gap-4 p-4">
        <div className="flex flex-1 items-center justify-center rounded-lg bg-zinc-900 p-4">
          <BoardView
            viewBox={FULL_VIEW_BOX}
            rotationDeg={0}
            markers={markers}
            onPick={handleFullBoardPick}
            className="h-full max-h-[70vh] w-auto"
          />
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg bg-zinc-900 p-4">
          <BoardView
            viewBox={ZOOM_VIEW_BOX}
            rotationDeg={zoomRotationDeg}
            markers={markers}
            onPick={handleZoomPick}
            className="h-full max-h-[70vh] w-auto"
          />
        </div>
      </main>

      <footer className="flex flex-col gap-3 border-t border-zinc-800 px-6 py-4">
        {currentThrows.length > 0 && (
          <div className="flex gap-4 text-sm text-zinc-300">
            {currentThrows.map((t) => (
              <span key={t.id}>
                <span className="font-semibold text-yellow-400">{t.suffix.toUpperCase()}</span>{" "}
                {t.score.label} ({t.score.value}) — {t.distanceFromTarget.toFixed(1)} units from target
              </span>
            ))}
            {currentThrows.length === 3 && (
              <span className="font-semibold text-zinc-100">
                Turn total: {currentThrows.reduce((sum, t) => sum + t.score.value, 0)}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {phase === "setting-target" && (
            <Button disabled={!canConfirmTarget} onClick={handleConfirmTarget}>
              Confirm Target
            </Button>
          )}
          {canMoveTarget && (
            <Button variant="secondary" onClick={handleMoveTarget}>
              Move Target
            </Button>
          )}
          {canEndTurn && <Button onClick={handleEndTurn}>End Turn?</Button>}
        </div>
      </footer>
    </div>
  );
}

function statusLine(phase: Phase, turnNumber: number, throwsLogged: number) {
  if (phase === "idle") return "Tap Start Game to begin a practice session.";
  if (phase === "setting-target")
    return "Tap the full board to set your target, refine it, then confirm.";
  return `Turn ${turnNumber} — ${throwsLogged}/3 darts logged.`;
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary: "bg-blue-600 hover:bg-blue-500",
    secondary: "bg-zinc-700 hover:bg-zinc-600",
    danger: "bg-red-700 hover:bg-red-600",
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}
