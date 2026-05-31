import type { BidValue, GameMode } from "../domain/types";
import type { OnlinePrivateHand, OnlineRoomSnapshot } from "./types";

export interface OnlineRoomGateway {
  restoreRoom(): Promise<OnlineRoomSnapshot | undefined>;
  createRoom(input: {
    displayName: string;
    mode: GameMode;
    passphrase: string;
  }): Promise<OnlineRoomSnapshot>;
  joinRoom(input: {
    inviteCode: string;
    passphrase: string;
    displayName: string;
  }): Promise<OnlineRoomSnapshot>;
  startRoom(roomId: string): Promise<OnlineRoomSnapshot>;
  getMyHand(roomId: string): Promise<OnlinePrivateHand>;
  sealBid(roomId: string, bid: BidValue, roundIndex: number): Promise<OnlineRoomSnapshot>;
  revealRound(roomId: string): Promise<OnlineRoomSnapshot>;
  advanceRound(roomId: string): Promise<OnlineRoomSnapshot>;
  rematch(roomId: string): Promise<OnlineRoomSnapshot>;
  subscribe(roomId: string, onSnapshot: (snapshot: OnlineRoomSnapshot) => void): () => void;
}
