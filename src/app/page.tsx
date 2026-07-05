"use client";

import { useMemo, useRef, useState } from "react";
import { BoardView, type BoardMarker } from "@/components/BoardView";
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
import { boardCropViewBox, nearestNumberOrBullLabel } from "@/lib/dartboard";
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

const THROW_SUFFIXES: ThrowSuffix[] = ["a", "b", "c"];

type Phase = "idle" | "setting-target" | "throwing";

interface EditingPastTurn {
  label: string;
  turn: Turn;
  throws: ThrowRecord[];
  onUpdate: (throws: ThrowRecord[]) => void;
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

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [game, setGame] = useState<Game | null>(null);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turnNumber, setTurnNumber] = useState(0);

  const [pendingTarget, setPendingTarget] = useState<Point | null>(null);
  const [confirmedTarget, setConfirmedTarget] = useState<Point | null>(null);
  const [currentThrows, setCurrentThrows] = useState<ThrowRecord[]>([]);
  // Tracks how many darts have been claimed for the current turn synchronously
  // (unlike currentThrows.length, which only updates after a render commits),
  // so two taps fired back-to-back can never both claim the same dart slot.
  const nextThrowIndexRef = useRef(0);
  const currentThrowsRef = useRef<ThrowRecord[]>([]);

  // Manual override to see the whole board instead of the current Target's
  // zoomed crop — for tapping a wild throw that landed outside it. Reverts
  // automatically after the next tap.
  const [showFullBoardOverride, setShowFullBoardOverride] = useState(false);

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

  const displayedTarget = editingPastTurn
    ? editingPastTurn.turn.target
    : phase === "setting-target"
      ? pendingTarget
      : confirmedTarget;
  const displayedThrows = editingPastTurn ? editingPastTurn.throws : currentThrows;

  const boardViewBox = useMemo(
    () => boardCropViewBox(showFullBoardOverride ? null : displayedTarget),
    [showFullBoardOverride, displayedTarget]
  );

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
    setShowFullBoardOverride(false);
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
    setShowFullBoardOverride(false);
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
    setShowFullBoardOverride(false);
    setEditingPastTurn(null);
    setEditingThrowIndex(null);
    setShowNewGameModal(false);
    setPhase("throwing");
  }

  function handlePick(point: Point) {
    const wasOverriding = showFullBoardOverride;
    if (editingPastTurn) {
      void handlePastTurnEditTap(point);
    } else if (phase === "setting-target") {
      setPendingTarget(point);
    } else if (phase === "throwing") {
      void logOrUpdateThrow(point);
    }
    if (wasOverriding) setShowFullBoardOverride(false);
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
  }

  const canConfirmTarget = phase === "setting-target" && pendingTarget !== null && !editingPastTurn;
  const canMoveTarget =
    phase === "throwing" &&
    currentThrows.length === 0 &&
    game?.mode !== "cricket-practice" &&
    !editingPastTurn;
  const canToggleFullBoard = displayedTarget !== null;

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
            viewBox={boardViewBox}
            markers={markers}
            onPick={handlePick}
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
        {canToggleFullBoard && (
          <Button
            variant="secondary"
            onClick={() => setShowFullBoardOverride((v) => !v)}
          >
            {showFullBoardOverride ? "Zoomed View" : "Full Board"}
          </Button>
        )}
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
  if (editingPastTurn) return `Editing ${editingPastTurn.label} — tap a dart slot, then the board.`;
  if (phase === "idle") return "Tap New Game to begin a practice session.";
  if (game?.mode === "cricket-practice") {
    const spec = CRICKET_SEQUENCE[cricketSequenceIndex];
    const label = spec.kind === "bull" ? "Bull" : String(spec.number);
    return `Cricket Practice — Target ${label} — ${throwsLogged}/3 darts logged.`;
  }
  if (phase === "setting-target")
    return "Tap the board to set your target, refine it, then confirm.";
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
