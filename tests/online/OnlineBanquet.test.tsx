import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { OnlineBanquet } from "../../src/online/OnlineBanquet";
import type { OnlineRoomGateway } from "../../src/online/onlineRoomGateway";
import type { OnlineRoomSnapshot } from "../../src/online/types";

afterEach(cleanup);

describe("online banquet lobby", () => {
  it("offers invitation creation and spoken passphrase entry", async () => {
    render(<OnlineBanquet gatewayFactory={async () => createGateway()} onExit={() => undefined} />);

    expect(await screen.findByRole("button", { name: "招待状を作る" })).toBeVisible();
    expect(screen.getByRole("button", { name: "合言葉で入場" })).toBeVisible();
    expect(screen.getByText("合言葉は口頭で伝え、公開画面には残しません。")).toBeVisible();
  });

  it("lets only a host with another guest open the feast", async () => {
    const user = userEvent.setup();
    const gateway = createGateway();
    render(<OnlineBanquet gatewayFactory={async () => gateway} onExit={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "招待状を作る" }));
    await user.type(screen.getByLabelText("幹事の名前"), "やまだ");
    await user.type(screen.getByLabelText("合言葉"), "月夜のタルト");
    await user.click(screen.getByRole("button", { name: "招待状を発行する" }));

    expect(await screen.findByText("ABCD234567")).toBeVisible();
    expect(screen.getByRole("button", { name: "開宴する" })).toBeEnabled();
  });

  it("moves the host to the next private hand after advancing a revealed dish", async () => {
    const user = userEvent.setup();
    render(<OnlineBanquet gatewayFactory={async () => createGateway(revealedSnapshot())} onExit={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "次の皿へ" }));

    expect(await screen.findByText("やまだ さんの予約札")).toBeVisible();
  });

  it("opens a fresh private hand when the host starts a rematch", async () => {
    const user = userEvent.setup();
    render(<OnlineBanquet gatewayFactory={async () => createGateway(finishedSnapshot())} onExit={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "もう一度乾杯" }));

    expect(await screen.findByText("やまだ さんの予約札")).toBeVisible();
  });
});

function lobbySnapshot(): OnlineRoomSnapshot {
  return {
    roomId: "room-1",
    inviteCode: "ABCD234567",
    mode: "short",
    phase: "lobby",
    isHost: true,
    roundIndex: 0,
    roundNumber: 1,
    dishCount: 9,
    revision: 1,
    members: [
      { id: "host", displayName: "やまだ", seatIndex: 0, score: 0, isMe: true, sealed: false },
      { id: "guest", displayName: "さとう", seatIndex: 1, score: 0, isMe: false, sealed: false },
    ],
  };
}

function selectingSnapshot(): OnlineRoomSnapshot {
  return {
    ...lobbySnapshot(),
    phase: "selecting",
    revision: 4,
    currentDish: { id: "dish-2", points: 2, kind: "positive" },
  };
}

function revealedSnapshot(): OnlineRoomSnapshot {
  return {
    ...lobbySnapshot(),
    phase: "revealed",
    revision: 3,
    currentDish: { id: "dish-1", points: 1, kind: "positive" },
    revealedOutcome: {
      dish: { id: "dish-1", points: 1, kind: "positive" },
      selections: [
        { playerId: "host", bid: 15 },
        { playerId: "guest", bid: 1 },
      ],
      collidedBids: [],
      winnerId: "host",
      unserved: false,
    },
  };
}

function finishedSnapshot(): OnlineRoomSnapshot {
  return {
    ...revealedSnapshot(),
    phase: "finished",
    rankings: [
      { id: "host", displayName: "やまだ", score: 1, rank: 1 },
      { id: "guest", displayName: "さとう", score: 0, rank: 2 },
    ],
  };
}

function createGateway(restored?: OnlineRoomSnapshot): OnlineRoomGateway {
  const lobby = lobbySnapshot();
  const selecting = selectingSnapshot();
  return {
    restoreRoom: async () => restored,
    createRoom: async () => lobby,
    joinRoom: async () => lobby,
    startRoom: async () => lobby,
    getMyHand: async () => ({
      memberId: "host",
      displayName: "やまだ",
      remainingBids: [15, 14, 13],
      dish: selecting.currentDish!,
    }),
    sealBid: async () => lobby,
    revealRound: async () => lobby,
    advanceRound: async () => selecting,
    rematch: async () => selecting,
    subscribe: () => () => undefined,
  };
}
