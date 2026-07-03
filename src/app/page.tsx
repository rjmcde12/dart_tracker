"use client";

import { useMemo, useState } from "react";
import { BoardView, type BoardMarker, type BoardOverlayLabel } from "@/components/BoardView";
import { ThrowSlots } from "@/components/ThrowSlots";
import { NewGameModal } from "@/components/NewGameModal";
import { CricketResultsModal } from "@/components/CricketResultsModal";
import { createGame, createTurn, addThrow, endGame } from "@/lib/db";
import {
  RADII,
  sectorCenterAngleDeg,
  sectorIndexForPoint,
  sectorNumberForIndex,
} from "@/lib/dartboard";
import {
  CRICKET_SEQUENCE,
  cricketMarksForThrow,
  cricketTargetKey,
  cricketTargetPoint,
} from "@/lib/cricket";
import type {
  CricketVariant,
  Game,
  Point,
  Turn,
  ThrowRecord,
  ThrowSuffix,
} from "@/lib/types";

const FULL_VIEW_BOX = "-250 -250 500 500";
// Sector wedge points up (bull at bottom): crop from the bull out well past
// the board edge on top (extra margin so near-miss throws stay visible),
// with a small buffer below center.
const ZOOM_VIEW_BOX_UP = "-55 -260 110 280";
// Sector wedge points down (bull at top): mirror image of the above.
const ZOOM_VIEW_BOX_DOWN = "-55 -20 110 280";
// Bull target: a square crop reaching out to just inside the treble ring.
const BULL_ZOOM_VIEW_BOX = "-110 -110 220 220";
// The number-ring mask/label sit strictly between the double ring's outer
// edge and the board edge, so they never cut into the double ring itself.
const NUMBER_BAND_INNER = RADII.doubleOuter + 0.5; // 170
const NUMBER_BAND_OUTER = RADII.boardEdge; // 226
const THROW_SUFFIXES: ThrowSuffix[] = ["a", "b", "c"];

type Phase = "idle" | "setting-target" | "throwing";

type ZoomTarget = { kind: "sector"; index: number } | { kind: "bull" };

function computeZoomTarget(point: Point): ZoomTarget {
  const r = Math.hypot(point.x, point.y);
  if (r <= RADII.outerBullOuter) return { kind: "bull" };
  return { kind: "sector", index: sectorIndexForPoint(point.x, point.y) };
}

interface ZoomInfo {
  viewBox: string;
  rotationDeg: number;
  overlay: BoardOverlayLabel | null;
}

/**
 * The zoom panel always keeps the same visual orientation as the printed
 * board: rather than always forcing the targeted wedge to point up (which
 * would flip bottom-half numbers upside-down), a sector on the board's right
 * half (center angle < 180) points up with the bull at the bottom, while a
 * sector on the left half (>= 180) points down with the bull at the top.
 * The dartboard.svg's own number-ring text rotates along with the board and
 * would end up sideways/upside-down, so it's masked out and replaced with an
 * upright label placed at a fixed spot in the (unrotated) crop.
 */
function computeZoomInfo(target: ZoomTarget): ZoomInfo {
  if (target.kind === "bull") {
    return { viewBox: BULL_ZOOM_VIEW_BOX, rotationDeg: 0, overlay: null };
  }

  const angle = sectorCenterAngleDeg(target.index);
  const sectorNumber = sectorNumberForIndex(target.index);
  const pointsUp = angle < 180;

  const bandHeight = NUMBER_BAND_OUTER - NUMBER_BAND_INNER;

  return {
    viewBox: pointsUp ? ZOOM_VIEW_BOX_UP : ZOOM_VIEW_BOX_DOWN,
    rotationDeg: pointsUp ? -angle : 180 - angle,
    overlay: {
      text: String(sectorNumber),
      x: 0,
      y: pointsUp ? -(NUMBER_BAND_INNER + bandHeight / 2) : NUMBER_BAND_INNER + bandHeight / 2,
      maskX: -55,
      maskY: pointsUp ? -NUMBER_BAND_OUTER : NUMBER_BAND_INNER,
      maskWidth: 110,
      maskHeight: bandHeight,
    },
  };
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [game, setGame] = useState<Game | null>(null);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turnNumber, setTurnNumber] = useState(0);

  const [zoomTarget, setZoomTarget] = useState<ZoomTarget>({ kind: "sector", index: 0 });
  const [pendingTarget, setPendingTarget] = useState<Point | null>(null);
  const [confirmedTarget, setConfirmedTarget] = useState<Point | null>(null);
  const [currentThrows, setCurrentThrows] = useState<ThrowRecord[]>([]);
  const [editingThrowIndex, setEditingThrowIndex] = useState<number | null>(null);

  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [cricketVariant, setCricketVariant] = useState<CricketVariant | null>(null);
  const [cricketSequenceIndex, setCricketSequenceIndex] = useState(0);
  const [cricketTallies, setCricketTallies] = useState<Record<string, number>>({});
  const [cricketResults, setCricketResults] = useState<Record<string, number> | null>(null);

  const zoomInfo = useMemo(() => computeZoomInfo(zoomTarget), [zoomTarget]);

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

  function resetSessionState() {
    setGame(null);
    setTurn(null);
    setTurnNumber(0);
    setCurrentThrows([]);
    setEditingThrowIndex(null);
    setPendingTarget(null);
    setConfirmedTarget(null);
    setCricketVariant(null);
    setCricketSequenceIndex(0);
    setCricketTallies({});
    setPhase("idle");
  }

  async function handleStartFreePlay() {
    const newGame = await createGame("free-play");
    setGame(newGame);
    setTurn(null);
    setTurnNumber(0);
    setCurrentThrows([]);
    setEditingThrowIndex(null);
    setPendingTarget(null);
    setConfirmedTarget(null);
    setShowNewGameModal(false);
    setPhase("setting-target");
  }

  async function handleStartCricket(variant: CricketVariant) {
    const newGame = await createGame("cricket-practice", variant);
    const spec = CRICKET_SEQUENCE[0];
    const targetPoint = cricketTargetPoint(spec, variant);
    const newTurn = await createTurn(newGame.id, 1, targetPoint, spec);

    setGame(newGame);
    setCricketVariant(variant);
    setCricketSequenceIndex(0);
    setCricketTallies({});
    setTurn(newTurn);
    setTurnNumber(1);
    setConfirmedTarget(targetPoint);
    setPendingTarget(null);
    setCurrentThrows([]);
    setEditingThrowIndex(null);
    setZoomTarget(computeZoomTarget(targetPoint));
    setShowNewGameModal(false);
    setPhase("throwing");
  }

  function handleFullBoardPick(point: Point) {
    // The zoom panel only re-centers while choosing/refining a Target.
    // Once throwing has started it stays locked on the Target's sector —
    // see CLAUDE.md "Zoom behavior while throwing".
    if (phase === "setting-target") {
      setZoomTarget(computeZoomTarget(point));
    }
    handlePick(point);
  }

  function handleZoomPick(point: Point) {
    handlePick(point);
  }

  function handlePick(point: Point) {
    if (phase === "setting-target") {
      setPendingTarget(point);
    } else if (phase === "throwing") {
      void logOrUpdateThrow(point);
    }
  }

  async function logOrUpdateThrow(point: Point) {
    if (!turn) return;

    if (editingThrowIndex !== null) {
      const suffix = THROW_SUFFIXES[editingThrowIndex];
      const updated = await addThrow(turn, suffix, point);
      setCurrentThrows((prev) =>
        prev.map((t, i) => (i === editingThrowIndex ? updated : t))
      );
      setEditingThrowIndex(null);
      return;
    }

    if (currentThrows.length >= 3) return;
    const suffix = THROW_SUFFIXES[currentThrows.length];
    const throwRecord = await addThrow(turn, suffix, point);
    setCurrentThrows((prev) => [...prev, throwRecord]);
  }

  function handleSlotClick(index: number) {
    if (currentThrows.length !== 3) return;
    setEditingThrowIndex((prev) => (prev === index ? null : index));
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
    setEditingThrowIndex(null);
    setPhase("throwing");
  }

  async function handleEndTurn() {
    if (!game) return;

    if (game.mode === "cricket-practice") {
      await handleEndCricketTurn(game);
      return;
    }

    if (!confirmedTarget) return;
    const nextTurnNumber = turnNumber + 1;
    const newTurn = await createTurn(game.id, nextTurnNumber, confirmedTarget);
    setTurn(newTurn);
    setTurnNumber(nextTurnNumber);
    setCurrentThrows([]);
    setEditingThrowIndex(null);
  }

  async function handleEndCricketTurn(activeGame: Game) {
    const variant = cricketVariant;
    if (!variant) return;

    const spec = CRICKET_SEQUENCE[cricketSequenceIndex];
    const marksThisTurn = currentThrows.reduce(
      (sum, t) => sum + cricketMarksForThrow(t.score, spec),
      0
    );
    const updatedTallies = { ...cricketTallies, [cricketTargetKey(spec)]: marksThisTurn };
    setCricketTallies(updatedTallies);

    const nextIndex = cricketSequenceIndex + 1;
    if (nextIndex >= CRICKET_SEQUENCE.length) {
      await endGame(activeGame.id);
      setCricketResults(updatedTallies);
      resetSessionState();
      return;
    }

    const nextSpec = CRICKET_SEQUENCE[nextIndex];
    const nextTargetPoint = cricketTargetPoint(nextSpec, variant);
    const nextTurnNumber = turnNumber + 1;
    const newTurn = await createTurn(activeGame.id, nextTurnNumber, nextTargetPoint, nextSpec);

    setCricketSequenceIndex(nextIndex);
    setTurn(newTurn);
    setTurnNumber(nextTurnNumber);
    setConfirmedTarget(nextTargetPoint);
    setCurrentThrows([]);
    setEditingThrowIndex(null);
    setZoomTarget(computeZoomTarget(nextTargetPoint));
  }

  function handleMoveTarget() {
    setPendingTarget(confirmedTarget);
    setConfirmedTarget(null);
    setTurn(null);
    setEditingThrowIndex(null);
    setPhase("setting-target");
  }

  async function handleEndGame() {
    if (!game) return;
    await endGame(game.id);
    resetSessionState();
  }

  function openNewGameModal() {
    setCricketResults(null);
    setShowNewGameModal(true);
  }

  const canConfirmTarget = phase === "setting-target" && pendingTarget !== null;
  const canMoveTarget =
    phase === "throwing" && currentThrows.length === 0 && game?.mode !== "cricket-practice";
  const canEndTurn = phase === "throwing" && currentThrows.length === 3;

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Dart Practice Tracker</h1>
          <p className="text-sm text-zinc-400">
            {statusLine(phase, turnNumber, currentThrows.length, game, cricketSequenceIndex)}
          </p>
        </div>
        <div className="flex gap-2">
          {phase === "idle" && <Button onClick={openNewGameModal}>New Game</Button>}
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
            viewBox={zoomInfo.viewBox}
            rotationDeg={zoomInfo.rotationDeg}
            markers={markers}
            onPick={handleZoomPick}
            overlay={zoomInfo.overlay}
            className="h-full max-h-[70vh] w-auto"
          />
        </div>
        <ThrowSlots
          throws={currentThrows}
          editable={canEndTurn}
          editingIndex={editingThrowIndex}
          onSlotClick={handleSlotClick}
          canEndTurn={canEndTurn}
          onEndTurn={handleEndTurn}
          canConfirmTarget={canConfirmTarget}
          onConfirmTarget={handleConfirmTarget}
        />
      </main>

      <footer className="flex gap-2 border-t border-zinc-800 px-6 py-4">
        {canMoveTarget && (
          <Button variant="secondary" onClick={handleMoveTarget}>
            Move Target
          </Button>
        )}
      </footer>

      {showNewGameModal && (
        <NewGameModal
          onStartFreePlay={handleStartFreePlay}
          onStartCricket={handleStartCricket}
          onClose={() => setShowNewGameModal(false)}
        />
      )}

      {cricketResults && (
        <CricketResultsModal tallies={cricketResults} onNewGame={openNewGameModal} />
      )}
    </div>
  );
}

function statusLine(
  phase: Phase,
  turnNumber: number,
  throwsLogged: number,
  game: Game | null,
  cricketSequenceIndex: number
) {
  if (phase === "idle") return "Tap New Game to begin a practice session.";
  if (game?.mode === "cricket-practice") {
    const spec = CRICKET_SEQUENCE[cricketSequenceIndex];
    const label = spec.kind === "bull" ? "Bull" : String(spec.number);
    return `Cricket Practice — Target ${label} — ${throwsLogged}/3 darts logged.`;
  }
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
