import type { BidValue, Dish, GameMode, RoundOutcome } from "../domain/types";

export type OnlinePhase = "lobby" | "selecting" | "revealed" | "finished";

export interface OnlineRoomMember {
  id: string;
  displayName: string;
  seatIndex: number;
  score: number;
  isMe: boolean;
  sealed: boolean;
}

export interface OnlineRanking {
  id: string;
  displayName: string;
  score: number;
  rank: number;
}

export interface OnlineRoomSnapshot {
  roomId: string;
  inviteCode: string;
  mode: GameMode;
  phase: OnlinePhase;
  isHost: boolean;
  roundIndex: number;
  roundNumber: number;
  dishCount: number;
  revision: number;
  currentDish?: Dish;
  members: OnlineRoomMember[];
  revealedOutcome?: RoundOutcome;
  rankings?: OnlineRanking[];
}

export interface OnlinePrivateHand {
  memberId: string;
  displayName: string;
  remainingBids: BidValue[];
  dish: Dish;
}
