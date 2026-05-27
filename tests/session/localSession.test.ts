import { describe, expect, it } from "vitest";
import {
  advanceRound,
  createLocalSession,
  getPrivateTurn,
  getPublicSnapshot,
  openCurrentHand,
  rematchSession,
  revealRound,
  sealCard,
} from "../../src/session/localSession";
import { createLocalSessionAdapter } from "../../src/session/localSessionAdapter";

const ordered = <T>(values: T[]): T[] => values;

describe("local pass-and-play session", () => {
  it("exposes a guest's hand only after that guest opens the curtain", () => {
    const session = createLocalSession({ mode: "short", names: ["あおい", "れん"], shuffle: ordered });

    expect(session.phase).toBe("handoff");
    expect(getPublicSnapshot(session).players[0]).not.toHaveProperty("hand");

    const choosing = openCurrentHand(session);
    expect(getPrivateTurn(choosing).remainingBids).toContain(15);
  });

  it("does not expose a sealed reservation before the reveal", () => {
    let session = createLocalSession({ mode: "short", names: ["あおい", "れん"], shuffle: ordered });
    session = sealCard(openCurrentHand(session), 15);

    const betweenGuests = getPublicSnapshot(session);
    expect(session.phase).toBe("handoff");
    expect(betweenGuests.revealedOutcome).toBeUndefined();
    expect(JSON.stringify(betweenGuests)).not.toContain("pendingSelections");

    session = sealCard(openCurrentHand(session), 8);
    expect(session.phase).toBe("reveal-ready");
    expect(getPublicSnapshot(session).revealedOutcome).toBeUndefined();
  });

  it("reveals the resolved outcome only after every guest has sealed a card", () => {
    let session = createLocalSession({ mode: "short", names: ["あおい", "れん"], shuffle: ordered });
    session = sealCard(openCurrentHand(session), 15);
    session = sealCard(openCurrentHand(session), 8);
    session = revealRound(session);

    const shown = getPublicSnapshot(session);
    expect(session.phase).toBe("revealed");
    expect(shown.revealedOutcome?.winnerId).toBe(session.game.players[0].id);
    expect(shown.players[0].score).toBe(1);
  });

  it("finishes a short feast after nine revealed rounds", () => {
    let session = createLocalSession({ mode: "short", names: ["あおい", "れん"], shuffle: ordered });

    for (let round = 1; round <= 9; round += 1) {
      session = sealCard(openCurrentHand(session), round);
      session = sealCard(openCurrentHand(session), round);
      session = revealRound(session);
      if (round < 9) {
        session = advanceRound(session);
      }
    }

    expect(session.phase).toBe("finished");
    expect(getPublicSnapshot(session).rankings?.map(({ rank }) => rank)).toEqual([1, 1]);
  });

  it("finishes a full feast after fifteen revealed rounds", () => {
    let session = createLocalSession({ mode: "full", names: ["あおい", "れん"], shuffle: ordered });

    for (let round = 1; round <= 15; round += 1) {
      session = sealCard(openCurrentHand(session), round);
      session = sealCard(openCurrentHand(session), round);
      session = revealRound(session);
      if (round < 15) {
        session = advanceRound(session);
      }
    }

    expect(session.phase).toBe("finished");
    expect(getPublicSnapshot(session).roundNumber).toBe(15);
    expect(getPublicSnapshot(session).dishCount).toBe(15);
  });

  it("resets hands, scores and private choices for a rematch", () => {
    let session = createLocalSession({ mode: "short", names: ["あおい", "れん"], shuffle: ordered });
    session = sealCard(openCurrentHand(session), 15);
    session = sealCard(openCurrentHand(session), 1);
    session = revealRound(session);

    const replay = rematchSession(session, ordered);

    expect(replay.phase).toBe("handoff");
    expect(replay.game.players[0].remainingBids).toHaveLength(15);
    expect(replay.game.players[0].score).toBe(0);
    expect(getPublicSnapshot(replay).revealedOutcome).toBeUndefined();
  });

  it("protects unrevealed reservations through the session adapter boundary", () => {
    const adapter = createLocalSessionAdapter({
      mode: "short",
      names: ["あおい", "れん"],
      shuffle: ordered,
    });

    adapter.openCurrentHand();
    adapter.sealCard(15);

    expect(adapter.getSnapshot().phase).toBe("handoff");
    expect(adapter.getSnapshot().revealedOutcome).toBeUndefined();
  });
});
