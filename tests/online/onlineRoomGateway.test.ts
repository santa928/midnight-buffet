import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseOnlineRoomGateway,
  type SupabaseOnlinePort,
} from "../../src/online/supabaseOnlineRoomGateway";

const snapshot = {
  roomId: "room-1",
  inviteCode: "ABCD234567",
  mode: "short",
  phase: "lobby",
  roundIndex: 0,
  revision: 0,
  isHost: true,
  members: [{ id: "member-1", displayName: "幹事", seatIndex: 0, score: 0 }],
  sealedMemberIds: [],
  currentDish: null,
  revealedOutcome: null,
};

describe("Supabase online room gateway", () => {
  it("signs in anonymously before creating an invitation", async () => {
    const port = createFakePort();
    const gateway = createSupabaseOnlineRoomGateway(port);

    await gateway.createRoom({
      displayName: "幹事",
      mode: "short",
      passphrase: "月夜のタルト",
    });

    expect(port.calls).toEqual([
      "signInAnonymously",
      "create_banquet_room",
      "get_banquet_snapshot",
      "rememberRoom",
    ]);
  });

  it("refreshes a safe snapshot when a subscribed room changes", async () => {
    const port = createFakePort();
    const listener = vi.fn();
    const gateway = createSupabaseOnlineRoomGateway(port);

    const unsubscribe = gateway.subscribe("room-1", listener);
    await port.emitChange?.();

    expect(port.calls).toEqual(["subscribe", "get_banquet_snapshot"]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        members: [expect.objectContaining({ displayName: "幹事", sealed: false })],
      }),
    );
    expect(listener.mock.calls[0][0]).not.toHaveProperty("privateValuesFromOtherPlayers");
    unsubscribe();
  });

  it("seals a card against its dish round instead of a shared room revision", async () => {
    const port = createFakePort();
    const gateway = createSupabaseOnlineRoomGateway(port);

    await gateway.sealBid("room-1", 15, 2);

    expect(port.requests[0]).toEqual({
      functionName: "seal_banquet_bid",
      args: { p_room_id: "room-1", p_bid_value: 15, p_expected_round_index: 2 },
    });
  });
});

interface FakePort extends SupabaseOnlinePort {
  calls: string[];
  requests: Array<{ functionName: string; args?: Record<string, unknown> }>;
  emitChange?: () => Promise<void>;
}

function createFakePort(): FakePort {
  const calls: string[] = [];
  const requests: Array<{ functionName: string; args?: Record<string, unknown> }> = [];
  let changeListener: (() => Promise<void>) | undefined;
  return {
    calls,
    requests,
    async ensureAnonymousSession() {
      calls.push("signInAnonymously");
    },
    async rpc(functionName, args) {
      calls.push(functionName);
      requests.push({ functionName, args });
      if (functionName === "create_banquet_room") {
        return { roomId: "room-1", inviteCode: "ABCD234567" };
      }
      return snapshot;
    },
    rememberRoom() {
      calls.push("rememberRoom");
    },
    restoreRoomId() {
      return undefined;
    },
    subscribe(_roomId, onChange) {
      calls.push("subscribe");
      changeListener = onChange;
      return () => undefined;
    },
    async emitChange() {
      await changeListener?.();
    },
  };
}
