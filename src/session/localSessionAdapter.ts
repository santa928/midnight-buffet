import type { BidValue } from "../domain/types";
import {
  advanceRound,
  createLocalSession,
  getPrivateTurn,
  getPublicSnapshot,
  openCurrentHand,
  rematchSession,
  revealRound,
  sealCard,
} from "./localSession";
import type {
  LocalSessionState,
  PrivateTurnSnapshot,
  PublicSessionSnapshot,
  SessionAdapter,
  SetupConfig,
} from "./types";

/** Creates the replaceable local adapter used by the offline application. */
export function createLocalSessionAdapter(config: SetupConfig): SessionAdapter {
  let session: LocalSessionState = createLocalSession(config);

  return {
    getSnapshot(): PublicSessionSnapshot {
      return getPublicSnapshot(session);
    },
    openCurrentHand(): PrivateTurnSnapshot {
      session = openCurrentHand(session);
      return getPrivateTurn(session);
    },
    sealCard(bid: BidValue): PublicSessionSnapshot {
      session = sealCard(session, bid);
      return getPublicSnapshot(session);
    },
    revealRound(): PublicSessionSnapshot {
      session = revealRound(session);
      return getPublicSnapshot(session);
    },
    advanceRound(): PublicSessionSnapshot {
      session = advanceRound(session);
      return getPublicSnapshot(session);
    },
    rematch(): PublicSessionSnapshot {
      session = rematchSession(session);
      return getPublicSnapshot(session);
    },
  };
}
