export type GameMode = "short" | "full";
export type PlayerId = string;
export type BidValue = number;

export interface Dish {
  id: string;
  points: number;
  kind: "positive" | "negative";
}

export interface Selection {
  playerId: PlayerId;
  bid: BidValue;
}

export interface RoundOutcome {
  dish: Dish;
  selections: Selection[];
  collidedBids: BidValue[];
  winnerId: PlayerId | null;
  unserved: boolean;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  remainingBids: BidValue[];
  capturedDishes: Dish[];
  score: number;
}

export interface GameState {
  mode: GameMode;
  dishes: Dish[];
  currentDish?: Dish;
  players: PlayerState[];
  history: RoundOutcome[];
  roundIndex: number;
  finished: boolean;
}

export interface RankedPlayer extends PlayerState {
  rank: number;
}
