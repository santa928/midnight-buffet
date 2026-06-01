import { createGame, getRankings, playRound, rematch } from "../domain/game";
import type { BidValue } from "../domain/types";
import type {
  DishShuffler,
  LocalSessionState,
  PrivateTurnSnapshot,
  PublicSessionSnapshot,
  SetupConfig,
} from "./types";

/** Starts a local session whose shared surface initially masks all hands. */
export function createLocalSession(config: SetupConfig): LocalSessionState {
  assertNames(config.names);
  return {
    game: createGame(config.mode, config.names, config.shuffle),
    phase: "handoff",
    currentPlayerIndex: 0,
    pendingSelections: [],
  };
}

/** Returns state for the current guest after intentionally opening the curtain. */
export function openCurrentHand(session: LocalSessionState): LocalSessionState {
  if (session.phase !== "handoff") {
    throw new Error("端末受け渡し中のみ手札を開けます");
  }
  return { ...session, phase: "selecting" };
}

/** Returns only the active guest's private hand during their selection phase. */
export function getPrivateTurn(session: LocalSessionState): PrivateTurnSnapshot {
  if (session.phase !== "selecting" || !session.game.currentDish) {
    throw new Error("現在は予約札を選べません");
  }
  const player = session.game.players[session.currentPlayerIndex];
  return {
    playerId: player.id,
    playerName: player.name,
    dish: session.game.currentDish,
    remainingBids: [...player.remainingBids],
  };
}

/** Seals the active guest's choice and returns to a masked shared phase. */
export function sealCard(session: LocalSessionState, bid: BidValue): LocalSessionState {
  const privateTurn = getPrivateTurn(session);
  if (!privateTurn.remainingBids.includes(bid)) {
    throw new Error("使用済みの予約札です");
  }

  const pendingSelections = [
    ...session.pendingSelections,
    { playerId: privateTurn.playerId, bid },
  ];
  const allGuestsSealed = pendingSelections.length === session.game.players.length;

  return {
    ...session,
    phase: allGuestsSealed ? "reveal-ready" : "handoff",
    currentPlayerIndex: allGuestsSealed ? session.currentPlayerIndex : session.currentPlayerIndex + 1,
    pendingSelections,
  };
}

/** Reveals all sealed choices, resolves the dish and updates public scores. */
export function revealRound(session: LocalSessionState): LocalSessionState {
  if (session.phase !== "reveal-ready") {
    throw new Error("全員の予約札が揃っていません");
  }

  const game = playRound(session.game, session.pendingSelections);
  const revealedOutcome = game.history.at(-1);
  if (!revealedOutcome) {
    throw new Error("公開結果を取得できません");
  }

  return {
    ...session,
    game,
    phase: "revealed",
    revealedOutcome,
  };
}

/** Starts the next dish while returning every private value behind the curtain. */
export function advanceRound(session: LocalSessionState): LocalSessionState {
  if (session.phase !== "revealed") {
    throw new Error("公開結果の確認後に次へ進めます");
  }
  return {
    ...session,
    phase: session.game.finished ? "finished" : "handoff",
    currentPlayerIndex: 0,
    pendingSelections: [],
    revealedOutcome: undefined,
  };
}

/** Creates a clean rematch with the same guest list and selected mode. */
export function rematchSession(
  session: LocalSessionState,
  shuffle?: DishShuffler,
): LocalSessionState {
  return {
    game: rematch(session.game, shuffle),
    phase: "handoff",
    currentPlayerIndex: 0,
    pendingSelections: [],
  };
}

/** Converts local state into the only shape available to shared UI scenes. */
export function getPublicSnapshot(session: LocalSessionState): PublicSessionSnapshot {
  const showingResolvedDish = session.phase === "revealed" || session.phase === "finished";
  const snapshot: PublicSessionSnapshot = {
    mode: session.game.mode,
    phase: session.phase,
    roundNumber: Math.min(
      showingResolvedDish ? session.game.roundIndex : session.game.roundIndex + 1,
      session.game.dishes.length,
    ),
    dishCount: session.game.dishes.length,
    currentDish: session.game.currentDish,
    currentPlayerName:
      session.phase === "handoff" ? session.game.players[session.currentPlayerIndex]?.name : undefined,
    players: session.game.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      capturedDishes: [...player.capturedDishes],
      remainingBidCount: player.remainingBids.length,
    })),
  };

  if (session.phase === "revealed" || session.phase === "finished") {
    snapshot.revealedOutcome = session.revealedOutcome;
  }
  if (session.phase === "finished") {
    snapshot.rankings = getRankings(session.game.players);
  }
  return snapshot;
}

/** Ensures setup produces a usable and unambiguous guest list. */
function assertNames(names: string[]): void {
  if (names.length < 2 || names.length > 6) {
    throw new Error("参加者は2〜6人で登録してください");
  }
  const normalized = names.map((name) => name.trim());
  if (normalized.some((name) => name.length === 0) || new Set(normalized).size !== names.length) {
    throw new Error("名前は空欄なし・重複なしで入力してください");
  }
}
