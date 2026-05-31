import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";
import type { OnlineRoomGateway } from "../../src/online/onlineRoomGateway";
import type { OnlineRoomSnapshot } from "../../src/online/types";

const ordered = <T,>(values: T[]): T[] => values;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});

describe("offline banquet flow", () => {
  it("keeps local play open and marks online as pending without Supabase config", () => {
    render(<App shuffle={ordered} />);

    expect(screen.getByRole("button", { name: /この端末で遊ぶ/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /オンライン祝宴/ })).toBeDisabled();
    expect(screen.getByText("Vercel版で開場予定")).toBeVisible();
  });

  it("opens the online entrance when a gateway factory is available", async () => {
    const user = userEvent.setup();
    render(<App onlineGatewayFactory={async () => emptyOnlineGateway()} shuffle={ordered} />);

    await user.click(screen.getByRole("button", { name: /オンライン祝宴/ }));

    expect(await screen.findByText("招待状を作る")).toBeVisible();
  });

  it("validates names before opening the feast", async () => {
    const user = userEvent.setup();
    render(<App shuffle={ordered} />);
    await openOffline(user);

    const names = screen.getAllByRole("textbox");
    await user.type(names[0], "あおい");
    await user.type(names[1], "あおい");
    await user.click(screen.getByRole("button", { name: "祝宴を始める" }));

    expect(screen.getByText("名前は空欄なし・重複なしで入力してください")).toBeVisible();
  });

  it("keeps sealed cards private until the cloche reveal", async () => {
    const user = userEvent.setup();
    render(<App shuffle={ordered} />);
    await openOffline(user);

    const names = screen.getAllByRole("textbox");
    await user.type(names[0], "あおい");
    await user.type(names[1], "れん");
    await user.click(screen.getByRole("button", { name: "祝宴を始める" }));

    expect(screen.getByText("次は あおい さん")).toBeVisible();
    expect(screen.queryByRole("button", { name: "予約札 15" })).not.toBeInTheDocument();

    vi.useFakeTimers();
    openHand();
    fireEvent.click(screen.getByRole("button", { name: "予約札 15" }));
    fireEvent.click(screen.getByRole("button", { name: "この札を封蝋する" }));

    expect(screen.getByText("次は れん さん")).toBeVisible();
    expect(screen.queryByText("予約札 15")).not.toBeInTheDocument();

    openHand();
    fireEvent.click(screen.getByRole("button", { name: "予約札 1" }));
    fireEvent.click(screen.getByRole("button", { name: "この札を封蝋する" }));

    expect(screen.getByRole("button", { name: "クロッシュを開ける" })).toBeVisible();
    expect(screen.queryByText("15")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "クロッシュを開ける" }));

    expect(screen.getByText("あおい さんが獲得")).toBeVisible();
    expect(screen.getAllByText("+1")).toHaveLength(2);
    expect(screen.getByText("15")).toBeVisible();
    expect(screen.getByText("ショート 1/9皿")).toBeVisible();
  });

  it("provides sound and reduced-motion settings on the play surface", async () => {
    const user = userEvent.setup();
    render(<App shuffle={ordered} />);

    expect(screen.getByRole("button", { name: "音を消す" })).toBeVisible();
    expect(screen.getByRole("button", { name: "演出を減らす" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "音を消す" }));
    await user.click(screen.getByRole("button", { name: "演出を減らす" }));

    expect(screen.getByRole("button", { name: "音を出す" })).toBeVisible();
    expect(screen.getByRole("button", { name: "演出を戻す" })).toBeVisible();
  });

  it("returns directly to a remembered online seat after a page reload", async () => {
    window.localStorage.setItem("midnight-buffet.online-room-id", "room-restore");
    render(<App onlineGatewayFactory={async () => restoredOnlineGateway()} shuffle={ordered} />);

    expect(await screen.findByText("席へ戻りました")).toBeVisible();
    expect(screen.getByText("RESTORE1234")).toBeVisible();
  });

  it("finishes a short feast and starts a rematch from the awards screen", async () => {
    const user = userEvent.setup();
    render(<App shuffle={ordered} />);
    await openOffline(user);
    const names = screen.getAllByRole("textbox");
    await user.type(names[0], "あおい");
    await user.type(names[1], "れん");
    await user.click(screen.getByRole("button", { name: "祝宴を始める" }));
    vi.useFakeTimers();

    for (let round = 0; round < 9; round += 1) {
      selectForGuest(15 - round);
      selectForGuest(1 + round);
      fireEvent.click(screen.getByRole("button", { name: "クロッシュを開ける" }));
      if (round < 8) {
        fireEvent.click(screen.getByRole("button", { name: "次の皿へ" }));
      }
    }

    expect(screen.getByText("あおい さんの勝利")).toBeVisible();
    expect(screen.getByRole("button", { name: "もう一度乾杯" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "もう一度乾杯" }));
    expect(screen.getByText("次は あおい さん")).toBeVisible();
  }, 15_000);
});

async function openOffline(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /この端末で遊ぶ/ }));
}

function openHand(): void {
  const trigger = screen.getByRole("button", { name: "長押しして手札を開く" });
  fireEvent.pointerDown(trigger);
  act(() => vi.advanceTimersByTime(500));
  fireEvent.pointerUp(trigger);
}

function selectForGuest(value: number): void {
  openHand();
  fireEvent.click(screen.getByRole("button", { name: `予約札 ${value}` }));
  fireEvent.click(screen.getByRole("button", { name: "この札を封蝋する" }));
}

function restoredOnlineGateway(): OnlineRoomGateway {
  const snapshot: OnlineRoomSnapshot = {
    roomId: "room-restore",
    inviteCode: "RESTORE1234",
    mode: "short",
    phase: "lobby",
    isHost: false,
    roundIndex: 0,
    roundNumber: 1,
    dishCount: 9,
    revision: 0,
    members: [{ id: "guest", displayName: "さとう", seatIndex: 1, score: 0, isMe: true, sealed: false }],
  };
  return {
    restoreRoom: async () => snapshot,
    createRoom: async () => snapshot,
    joinRoom: async () => snapshot,
    startRoom: async () => snapshot,
    getMyHand: async () => {
      throw new Error("not used");
    },
    sealBid: async () => snapshot,
    revealRound: async () => snapshot,
    advanceRound: async () => snapshot,
    rematch: async () => snapshot,
    subscribe: () => () => undefined,
  };
}

function emptyOnlineGateway(): OnlineRoomGateway {
  return {
    ...restoredOnlineGateway(),
    restoreRoom: async () => undefined,
  };
}
