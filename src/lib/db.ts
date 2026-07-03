import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Game, Point, Turn, ThrowRecord, ThrowSuffix } from "./types";
import { pointToScore, distance } from "./dartboard";

interface DartDB extends DBSchema {
  games: { key: string; value: Game };
  turns: { key: string; value: Turn; indexes: { gameId: string } };
  throws: {
    key: string;
    value: ThrowRecord;
    indexes: { turnId: string; gameId: string };
  };
}

let dbPromise: Promise<IDBPDatabase<DartDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<DartDB>("dart-practice", 1, {
      upgrade(db) {
        db.createObjectStore("games", { keyPath: "id" });

        const turns = db.createObjectStore("turns", { keyPath: "id" });
        turns.createIndex("gameId", "gameId");

        const throws = db.createObjectStore("throws", { keyPath: "id" });
        throws.createIndex("turnId", "turnId");
        throws.createIndex("gameId", "gameId");
      },
    });
  }
  return dbPromise;
}

export async function createGame(): Promise<Game> {
  const game: Game = {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    endedAt: null,
  };
  const db = await getDb();
  await db.put("games", game);
  return game;
}

export async function endGame(gameId: string): Promise<void> {
  const db = await getDb();
  const game = await db.get("games", gameId);
  if (!game) return;
  game.endedAt = Date.now();
  await db.put("games", game);
}

export async function createTurn(
  gameId: string,
  turnNumber: number,
  target: Point
): Promise<Turn> {
  const turn: Turn = {
    id: `${gameId}-t${turnNumber}`,
    gameId,
    turnNumber,
    target,
    createdAt: Date.now(),
  };
  const db = await getDb();
  await db.put("turns", turn);
  return turn;
}

export async function addThrow(
  turn: Turn,
  suffix: ThrowSuffix,
  position: Point
): Promise<ThrowRecord> {
  const throwRecord: ThrowRecord = {
    id: `${turn.id}${suffix}`,
    turnId: turn.id,
    gameId: turn.gameId,
    suffix,
    position,
    score: pointToScore(position.x, position.y),
    distanceFromTarget: distance(turn.target, position),
    createdAt: Date.now(),
  };
  const db = await getDb();
  await db.put("throws", throwRecord);
  return throwRecord;
}
