import type {
  BidValue,
  Dish,
  GameMode,
  GameState,
  RankedPlayer,
  RoundOutcome,
} from "../domain/types";

export type SessionPhase = "handoff" | "selecting" | "reveal-ready" | "revealed" | "finished";
export type DishShuffler = (values: Dish[]) => Dish[];

export interface SetupConfig {
  mode: GameMode;
  names: string[];
  shuffle?: DishShuffler;
}

export interface LocalSessionState {
  game: GameState;
  phase: SessionPhase;
  currentPlayerIndex: number;
  pendingSelections: Array<{ playerId: string; bid: BidValue }>;
  revealedOutcome?: RoundOutcome;
}

export interface PublicPlayerSnapshot {
  id: string;
  name: string;
  score: number;
  capturedDishes: Dish[];
  remainingBidCount: number;
}

export interface PublicSessionSnapshot {
  mode: GameMode;
  phase: SessionPhase;
  roundNumber: number;
  dishCount: number;
  currentDish?: Dish;
  currentPlayerName?: string;
  players: PublicPlayerSnapshot[];
  revealedOutcome?: RoundOutcome;
  rankings?: RankedPlayer[];
}

export interface PrivateTurnSnapshot {
  playerId: string;
  playerName: string;
  dish: Dish;
  remainingBids: BidValue[];
}

export interface SessionAdapter {
  getSnapshot(): PublicSessionSnapshot;
  openCurrentHand(): PrivateTurnSnapshot;
  sealCard(bid: BidValue): PublicSessionSnapshot;
  revealRound(): PublicSessionSnapshot;
  advanceRound(): PublicSessionSnapshot;
  rematch(): PublicSessionSnapshot;
}

