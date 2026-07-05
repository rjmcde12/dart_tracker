"use client";

import { useMemo, useRef, useState } from "react";
import { BoardView, type BoardMarker, type BoardOverlayLabel } from "@/components/BoardView";
import { ThrowSlots } from "@/components/ThrowSlots";
import { NewGameModal } from "@/components/NewGameModal";
import { CricketResultsModal } from "@/components/CricketResultsModal";
import { CricketScoreboard } from "@/components/CricketScoreboard";
import { FreePlayHistory, type FreePlayTurnSummary } from "@/components/FreePlayHistory";
import {
  createGame,
  createTurn,
  addThrow,
  endGame,
  getAllTurns,
  getThrowsForTurn,
} from "@/lib/db";
import {
  RADII,
  nearestNumberOrBullLabel,
  sectorCenterAngleDeg,
  sectorIndexForPoint,
  sectorNumberForIndex,
} from "@/lib/dartboard";
import {
  CRICKET_SEQUENCE,
  cricketTallyForTurn,
  cricketTargetKey,
  cricketTargetLabel,
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

interface EditingPastTurn {
  label: string;
  turn: Turn;
  throws: ThrowRecord[];
  onUpdate: (throws: ThrowRecord[]) => void;
}

function computeZoomTarget(point: Point): ZoomTarget {
  const r = Math.hypot(point.x, point.y);
  if (r <= RADII.outerBullOuter) return { kind: "bull" };
  return { kind: "sector", index: sectorIndexForPoint(point.x, point.y) };
}

/** Highest tally ever recorded (across all past cricket games) for each target. */
async function computeCricketBestTallies(): Promise<Record<string, number>> {
  const allTurns = await getAllTurns();
  const best: Record<string, number> = {};

  for (const spec of CRICKET_SEQUENCE) {
    const key = cricketTargetKey(spec);
    const matchingTurns = allTurns.filter(
      (t) => t.cricketTarget && cricketTargetKey(t.cricketTarget) === key
    );

    let max = 0;
    for (const t of matchingTurns) {
      const throws = await getThrowsForTurn(t.id);
      const total = cricketTallyForTurn(throws, spec);
      if (total > max) max = total;
    }
    best[key] = max;
  }

  return best;
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
  // Tracks how many darts have been claimed for the current turn synchronously
  // (unlike currentThrows.length, which only updates after a render commits),
  // so two taps fired back-to-back can never both claim the same dart slot.
  const nextThrowIndexRef = useRef(0);
  const currentThrowsRef = useRef<ThrowRecord[]>([]);

  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [cricketVariant, setCricketVariant] = useState<CricketVariant | null>(null);
  const [lastCricketVariant, setLastCricketVariant] = useState<CricketVariant | null>(null);
  const [cricketSequenceIndex, setCricketSequenceIndex] = useState(0);
  const [cricketTurns, setCricketTurns] = useState<Record<string, { turn: Turn; throws: ThrowRecord[] }>>({});
  const [cricketResults, setCricketResults] = useState<Record<string, ThrowRecord[]> | null>(null);
  const [cricketBest, setCricketBest] = useState<Record<string, number>>({});
  const [freePlayHistory, setFreePlayHistory] = useState<FreePlayTurnSummary[]>([]);

  // Editing a past (already-ended) turn, entered by tapping its row in the
  // Cricket scoreboard / Free Play history panel — see "Editing a past turn".
  const [editingPastTurn, setEditingPastTurn] = useState<EditingPastTurn | null>(null);
  const [editingThrowIndex, setEditingThrowIndex] = useState<number | null>(null);

  const zoomInfo = useMemo(() => computeZoomInfo(zoomTarget), [zoomTarget]);

  const displayedTarget = editingPastTurn
    ? editingPastTurn.turn.target
    : phase === "setting-target"
      ? pendingTarget
      : confirmedTarget;
  const displayedThrows = editingPastTurn ? editingPastTurn.throws : currentThrows;

  const markers: BoardMarker[] = useMemo(() => {
    const list: BoardMarker[] = [];
    if (displayedTarget) {
      list.push({ point: displayedTarget, kind: "target" });
    }
    displayedThrows.forEach((t, i) => {
      list.push({ point: t.position, kind: "throw", label: String(i + 1) });
    });
    return list;
  }, [displayedTarget, displayedThrows]);

  const cricketThrowsByTarget = useMemo(() => {
    const result: Record<string, ThrowRecord[]> = {};
    for (const [key, record] of Object.entries(cricketTurns)) {
      result[key] = record.throws;
    }
    return result;
  }, [cricketTurns]);

  function resetSessionState() {
    setGame(null);
    setTurn(null);
    setTurnNumber(0);
    setCurrentThrows([]);
    currentThrowsRef.current = [];
    nextThrowIndexRef.current = 0;
    setPendingTarget(null);
    setConfirmedTarget(null);
    setCricketVariant(null);
    setCricketSequenceIndex(0);
    setCricketTurns({});
    setFreePlayHistory([]);
    setEditingPastTurn(null);
    setEditingThrowIndex(null);
    setPhase("idle");
  }

  async function handleStartFreePlay() {
    const newGame = await createGame("free-play");
    setGame(newGame);
    setTurn(null);
    setTurnNumber(0);
    setCurrentThrows([]);
    currentThrowsRef.current = [];
    nextThrowIndexRef.current = 0;
    setPendingTarget(null);
    setConfirmedTarget(null);
    setFreePlayHistory([]);
    setEditingPastTurn(null);
    setEditingThrowIndex(null);
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
    setLastCricketVariant(variant);
    setCricketSequenceIndex(0);
    setCricketTurns({});
    setTurn(newTurn);
    setTurnNumber(1);
    setConfirmedTarget(targetPoint);
    setPendingTarget(null);
    setCurrentThrows([]);
    currentThrowsRef.current = [];
    nextThrowIndexRef.current = 0;
    setEditingPastTurn(null);
    setEditingThrowIndex(null);
    setZoomTarget(computeZoomTarget(targetPoint));
    setShowNewGameModal(false);
    setPhase("throwing");
  }

  function handleFullBoardPick(point: Point) {
    // The zoom panel only re-centers while choosing/refining a Target.
    // Once throwing has started it stays locked on the Target's sector —
    // see CLAUDE.md "Zoom behavior while throwing".
    if (phase === "setting-target" && !editingPastTurn) {
      setZoomTarget(computeZoomTarget(point));
    }
    handlePick(point);
  }

  function handleZoomPick(point: Point) {
    handlePick(point);
  }

  function handlePick(point: Point) {
    if (editingPastTurn) {
      void handlePastTurnEditTap(point);
      return;
    }
    if (phase === "setting-target") {
      setPendingTarget(point);
    } else if (phase === "throwing") {
      void logOrUpdateThrow(point);
    }
  }

  async function handlePastTurnEditTap(point: Point) {
    if (!editingPastTurn || editingThrowIndex === null) return;
    const suffix = THROW_SUFFIXES[editingThrowIndex];
    const updated = await addThrow(editingPastTurn.turn, suffix, point);
    const newThrows = editingPastTurn.throws.map((t, i) =>
      i === editingThrowIndex ? updated : t
    );
    editingPastTurn.onUpdate(newThrows);
    setEditingPastTurn((prev) => (prev ? { ...prev, throws: newThrows } : prev));
    setEditingThrowIndex(null);
  }

  async function logOrUpdateThrow(point: Point) {
    if (!turn || !game) return;
    if (nextThrowIndexRef.current >= 3) return;

    const index = nextThrowIndexRef.current;
    nextThrowIndexRef.current += 1;
    const suffix = THROW_SUFFIXES[index];
    const throwRecord = await addThrow(turn, suffix, point);
    const updatedThrows = [...currentThrowsRef.current, throwRecord];
    currentThrowsRef.current = updatedThrows;
    setCurrentThrows(updatedThrows);

    if (updatedThrows.length === 3) {
      await autoEndTurn(game, turn, updatedThrows);
    }
  }

  function handleSlotClick(index: number) {
    if (!editingPastTurn) return;
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
    currentThrowsRef.current = [];
    nextThrowIndexRef.current = 0;
    setPhase("throwing");
  }

  /** Fires the moment a turn's 3rd dart is logged — no manual End Turn anymore. */
  async function autoEndTurn(activeGame: Game, finishedTurn: Turn, finishedThrows: ThrowRecord[]) {
    if (activeGame.mode === "cricket-practice") {
      await autoEndCricketTurn(activeGame, finishedTurn, finishedThrows);
      return;
    }

    if (!confirmedTarget) return;
    setFreePlayHistory((prev) =>
      [{ turn: finishedTurn, throws: finishedThrows }, ...prev].slice(0, 5)
    );

    const nextTurnNumber = turnNumber + 1;
    const newTurn = await createTurn(activeGame.id, nextTurnNumber, confirmedTarget);
    setTurn(newTurn);
    setTurnNumber(nextTurnNumber);
    setCurrentThrows([]);
    currentThrowsRef.current = [];
    nextThrowIndexRef.current = 0;
  }

  async function autoEndCricketTurn(activeGame: Game, finishedTurn: Turn, finishedThrows: ThrowRecord[]) {
    const variant = cricketVariant;
    if (!variant) return;

    const spec = CRICKET_SEQUENCE[cricketSequenceIndex];
    const key = cricketTargetKey(spec);
    const updatedCricketTurns = {
      ...cricketTurns,
      [key]: { turn: finishedTurn, throws: finishedThrows },
    };
    setCricketTurns(updatedCricketTurns);

    const nextIndex = cricketSequenceIndex + 1;
    if (nextIndex >= CRICKET_SEQUENCE.length) {
      await endGame(activeGame.id);
      const best = await computeCricketBestTallies();
      setCricketBest(best);
      const throwsOnly: Record<string, ThrowRecord[]> = {};
      for (const [k, record] of Object.entries(updatedCricketTurns)) {
        throwsOnly[k] = record.throws;
      }
      setCricketResults(throwsOnly);
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
    currentThrowsRef.current = [];
    nextThrowIndexRef.current = 0;
    setZoomTarget(computeZoomTarget(nextTargetPoint));
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
    resetSessionState();
  }

  function openNewGameModal() {
    setCricketResults(null);
    setShowNewGameModal(true);
  }

  async function handleRestartCricketGame() {
    setCricketResults(null);
    if (!lastCricketVariant) return;
    await handleStartCricket(lastCricketVariant);
  }

  function handleDoneEditing() {
    setEditingPastTurn(null);
    setEditingThrowIndex(null);
    if (confirmedTarget) setZoomTarget(computeZoomTarget(confirmedTarget));
  }

  function handleEditCricketRow(key: string) {
    const record = cricketTurns[key];
    if (!record) return;
    if (editingPastTurn?.turn.id === record.turn.id) {
      handleDoneEditing();
      return;
    }
    const spec = CRICKET_SEQUENCE.find((s) => cricketTargetKey(s) === key);
    setEditingPastTurn({
      label: spec ? cricketTargetLabel(spec) : key,
      turn: record.turn,
      throws: record.throws,
      onUpdate: (throws) =>
        setCricketTurns((prev) => ({ ...prev, [key]: { turn: record.turn, throws } })),
    });
    setEditingThrowIndex(null);
    setZoomTarget(computeZoomTarget(record.turn.target));
  }

  function handleEditFreePlayRow(index: number) {
    const record = freePlayHistory[index];
    if (!record) return;
    if (editingPastTurn?.turn.id === record.turn.id) {
      handleDoneEditing();
      return;
    }
    setEditingPastTurn({
      label: nearestNumberOrBullLabel(record.turn.target),
      turn: record.turn,
      throws: record.throws,
      onUpdate: (throws) =>
        setFreePlayHistory((prev) => prev.map((r, i) => (i === index ? { ...r, throws } : r))),
    });
    setEditingThrowIndex(null);
    setZoomTarget(computeZoomTarget(record.turn.target));
  }

  const canConfirmTarget = phase === "setting-target" && pendingTarget !== null && !editingPastTurn;
  const canMoveTarget =
    phase === "throwing" &&
    currentThrows.length === 0 &&
    game?.mode !== "cricket-practice" &&
    !editingPastTurn;

  const editingCricketKey =
    editingPastTurn?.turn.cricketTarget
      ? cricketTargetKey(editingPastTurn.turn.cricketTarget)
      : null;
  const editingFreePlayTurnId = editingPastTurn?.turn.id ?? null;

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Dart Practice Tracker</h1>
          <p className="text-sm text-zinc-400">
            {statusLine(phase, turnNumber, currentThrows.length, game, cricketSequenceIndex, editingPastTurn)}
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
        <div className="flex w-56 flex-col gap-4 overflow-y-auto">
          <ThrowSlots
            throws={displayedThrows}
            editable={!!editingPastTurn}
            editingIndex={editingThrowIndex}
            onSlotClick={handleSlotClick}
            canConfirmTarget={canConfirmTarget}
            onConfirmTarget={handleConfirmTarget}
            isEditingPastTurn={!!editingPastTurn}
            editingLabel={editingPastTurn?.label}
            onDoneEditing={handleDoneEditing}
          />
          {game?.mode === "cricket-practice" && (
            <CricketScoreboard
              throwsByTarget={cricketThrowsByTarget}
              editingKey={editingCricketKey}
              onRowClick={handleEditCricketRow}
            />
          )}
          {game?.mode === "free-play" && (
            <FreePlayHistory
              history={freePlayHistory}
              editingTurnId={editingFreePlayTurnId}
              onRowClick={handleEditFreePlayRow}
            />
          )}
        </div>
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
        <CricketResultsModal
          throwsByTarget={cricketResults}
          best={cricketBest}
          onRestartGame={handleRestartCricketGame}
          onChangeGameType={openNewGameModal}
        />
      )}
    </div>
  );
}

function statusLine(
  phase: Phase,
  turnNumber: number,
  throwsLogged: number,
  game: Game | null,
  cricketSequenceIndex: number,
  editingPastTurn: EditingPastTurn | null
) {
  if (editingPastTurn) return `Editing ${editingPastTurn.label} — tap a dart slot, then a board.`;
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
