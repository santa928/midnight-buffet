import { createBidCards, createDishDeck } from "./decks";
import { resolveRound } from "./resolveRound";
import type {
  Dish,
  GameMode,
  GameState,
  PlayerState,
  RankedPlayer,
  Selection,
} from "./types";

type DishShuffler = (values: Dish[]) => Dish[];

/** Creates a fresh feast with common reservation hands for every guest. */
export function createGame(
  mode: GameMode,
  names: string[],
  shuffle?: DishShuffler,
): GameState {
  const dishes = createDishDeck(mode, shuffle);
  const players = names.map((name, index) => createPlayer(name, index));

  return {
    mode,
    dishes,
    currentDish: dishes[0],
    players,
    history: [],
    roundIndex: 0,
    finished: false,
  };
}

/** Resolves a complete set of secret reservations and advances the feast. */
export function playRound(state: GameState, selections: Selection[]): GameState {
  if (state.finished || !state.currentDish) {
    throw new Error("祝宴は終了しています");
  }
  assertCompleteSelections(state.players, selections);

  const outcome = resolveRound(state.currentDish, selections);
  const players = state.players.map((player) => applySelection(player, selections, outcome));
  const roundIndex = state.roundIndex + 1;
  const currentDish = state.dishes[roundIndex];

  return {
    ...state,
    currentDish,
    players,
    history: [...state.history, outcome],
    roundIndex,
    finished: currentDish === undefined,
  };
}

/** Returns score-sorted guests while keeping equal scores at equal rank. */
export function getRankings(players: PlayerState[]): RankedPlayer[] {
  const sorted = [...players].sort((left, right) => right.score - left.score);
  return sorted.map((player) => ({
    ...player,
    rank: sorted.findIndex((candidate) => candidate.score === player.score) + 1,
  }));
}

/** Starts a new randomized feast using the same mode and guest names. */
export function rematch(state: GameState, shuffle?: DishShuffler): GameState {
  return createGame(
    state.mode,
    state.players.map(({ name }) => name),
    shuffle,
  );
}

/** Creates initial state for one invited guest. */
function createPlayer(name: string, index: number): PlayerState {
  return {
    id: `player-${index + 1}`,
    name,
    remainingBids: createBidCards(),
    capturedDishes: [],
    score: 0,
  };
}

/** Applies the revealed card use and possible captured dish to one guest. */
function applySelection(
  player: PlayerState,
  selections: Selection[],
  outcome: ReturnType<typeof resolveRound>,
): PlayerState {
  const selection = selections.find(({ playerId }) => playerId === player.id);
  if (!selection || !player.remainingBids.includes(selection.bid)) {
    throw new Error("使用済みの予約札です");
  }

  const capturedDishes =
    outcome.winnerId === player.id
      ? [...player.capturedDishes, outcome.dish]
      : player.capturedDishes;

  return {
    ...player,
    remainingBids: player.remainingBids.filter((bid) => bid !== selection.bid),
    capturedDishes,
    score: capturedDishes.reduce((total, dish) => total + dish.points, 0),
  };
}

/** Rejects incomplete or duplicated player entries before resolving a round. */
function assertCompleteSelections(players: PlayerState[], selections: Selection[]): void {
  if (selections.length !== players.length) {
    throw new Error("全員の予約札が必要です");
  }

  const enteredIds = new Set(selections.map(({ playerId }) => playerId));
  const knownPlayers = players.every(({ id }) => enteredIds.has(id));
  if (enteredIds.size !== players.length || !knownPlayers) {
    throw new Error("参加者ごとに1枚の予約札が必要です");
  }
}
