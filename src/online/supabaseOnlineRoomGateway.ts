import type { SupabaseClient } from "@supabase/supabase-js";
import type { BidValue, Dish, GameMode, RoundOutcome } from "../domain/types";
import type { OnlineRoomGateway } from "./onlineRoomGateway";
import { rememberOnlineRoom, restoreOnlineRoomId } from "./roomStorage";
import { createBrowserSupabaseClient } from "./supabaseClient";
import type { OnlineRoomMember, OnlineRoomSnapshot } from "./types";

export interface SupabaseOnlinePort {
  ensureAnonymousSession(): Promise<void>;
  rpc(functionName: string, args?: Record<string, unknown>): Promise<unknown>;
  rememberRoom(roomId: string): void;
  restoreRoomId(): string | undefined;
  subscribe(roomId: string, onChange: () => Promise<void>): () => void;
}

interface RawSnapshot {
  roomId: string;
  inviteCode: string;
  mode: GameMode;
  phase: "lobby" | "selecting" | "revealed" | "finished";
  roundIndex: number;
  revision: number;
  isHost: boolean;
  members: Array<{
    id: string;
    displayName: string;
    seatIndex: number;
    score: number;
    isMe?: boolean;
  }>;
  sealedMemberIds: string[];
  currentDish?: Dish | null;
  revealedOutcome?: {
    dish: Dish;
    selections: Array<{ memberId: string; bid: number }>;
    collidedBids: number[];
    winnerId: string | null;
    unserved: boolean;
  } | null;
}

/** Implements online session operations exclusively through protected RPC snapshots. */
export function createSupabaseOnlineRoomGateway(port: SupabaseOnlinePort): OnlineRoomGateway {
  const revisions = new Map<string, number>();

  async function fetchSnapshot(roomId: string): Promise<OnlineRoomSnapshot> {
    const raw = (await port.rpc("get_banquet_snapshot", { p_room_id: roomId })) as RawSnapshot;
    const snapshot = normalizeSnapshot(raw);
    revisions.set(roomId, snapshot.revision);
    return snapshot;
  }

  async function runProgressRpc(functionName: string, roomId: string, args: Record<string, unknown> = {}) {
    const raw = (await port.rpc(functionName, {
      p_room_id: roomId,
      p_expected_revision: revisions.get(roomId) ?? null,
      ...args,
    })) as RawSnapshot;
    const snapshot = normalizeSnapshot(raw);
    revisions.set(roomId, snapshot.revision);
    return snapshot;
  }

  return {
    async restoreRoom() {
      const roomId = port.restoreRoomId();
      if (!roomId) return undefined;
      await port.ensureAnonymousSession();
      try {
        return await fetchSnapshot(roomId);
      } catch {
        return undefined;
      }
    },
    async createRoom(input) {
      await port.ensureAnonymousSession();
      const result = (await port.rpc("create_banquet_room", {
        p_display_name: input.displayName,
        p_requested_mode: input.mode,
        p_passphrase: input.passphrase,
      })) as { roomId: string };
      const snapshot = await fetchSnapshot(result.roomId);
      port.rememberRoom(result.roomId);
      return snapshot;
    },
    async joinRoom(input) {
      await port.ensureAnonymousSession();
      const roomId = (await port.rpc("join_banquet_room", {
        p_invite_code: input.inviteCode,
        p_display_name: input.displayName,
        p_passphrase: input.passphrase,
      })) as string | null;
      if (!roomId) throw new Error("招待状を確認してください");
      const snapshot = await fetchSnapshot(roomId);
      port.rememberRoom(roomId);
      return snapshot;
    },
    startRoom(roomId) {
      return runProgressRpc("start_banquet_room", roomId);
    },
    async getMyHand(roomId) {
      const snapshot = await fetchSnapshot(roomId);
      const myself = snapshot.members.find(({ isMe }) => isMe);
      if (!myself || !snapshot.currentDish) throw new Error("予約札を開けません");
      const remainingBids = (await port.rpc("get_my_banquet_hand", {
        p_room_id: roomId,
      })) as BidValue[];
      return {
        memberId: myself.id,
        displayName: myself.displayName,
        remainingBids,
        dish: snapshot.currentDish,
      };
    },
    async sealBid(roomId, bid, roundIndex) {
      const raw = (await port.rpc("seal_banquet_bid", {
        p_room_id: roomId,
        p_bid_value: bid,
        p_expected_round_index: roundIndex,
      })) as RawSnapshot;
      const snapshot = normalizeSnapshot(raw);
      revisions.set(roomId, snapshot.revision);
      return snapshot;
    },
    revealRound(roomId) {
      return runProgressRpc("reveal_banquet_round", roomId);
    },
    advanceRound(roomId) {
      return runProgressRpc("advance_banquet_round", roomId);
    },
    rematch(roomId) {
      return runProgressRpc("rematch_banquet_room", roomId);
    },
    subscribe(roomId, onSnapshot) {
      return port.subscribe(roomId, async () => {
        onSnapshot(await fetchSnapshot(roomId));
      });
    },
  };
}

/** Loads the browser SDK lazily and wraps only public-RPC access. */
export async function createBrowserOnlineRoomGateway(): Promise<OnlineRoomGateway> {
  const client = await createBrowserSupabaseClient();
  return createSupabaseOnlineRoomGateway(createBrowserPort(client));
}

/** Maps an RPC payload to the only state values that the online UI consumes. */
function normalizeSnapshot(raw: RawSnapshot): OnlineRoomSnapshot {
  const sealed = new Set(raw.sealedMemberIds);
  const members: OnlineRoomMember[] = raw.members.map((member) => ({
    ...member,
    isMe: member.isMe ?? false,
    sealed: sealed.has(member.id),
  }));
  const revealedOutcome: RoundOutcome | undefined = raw.revealedOutcome
    ? {
        dish: raw.revealedOutcome.dish,
        selections: raw.revealedOutcome.selections.map(({ memberId, bid }) => ({
          playerId: memberId,
          bid,
        })),
        collidedBids: raw.revealedOutcome.collidedBids,
        winnerId: raw.revealedOutcome.winnerId,
        unserved: raw.revealedOutcome.unserved,
      }
    : undefined;
  const sorted = [...members].sort((left, right) => right.score - left.score);
  return {
    roomId: raw.roomId,
    inviteCode: raw.inviteCode,
    mode: raw.mode,
    phase: raw.phase,
    isHost: raw.isHost,
    roundIndex: raw.roundIndex,
    roundNumber: raw.roundIndex + 1,
    dishCount: raw.mode === "short" ? 9 : 15,
    revision: raw.revision,
    currentDish: raw.currentDish ?? undefined,
    members,
    revealedOutcome,
    rankings:
      raw.phase === "finished"
        ? sorted.map((member) => ({
            id: member.id,
            displayName: member.displayName,
            score: member.score,
            rank: sorted.findIndex(({ score }) => score === member.score) + 1,
          }))
        : undefined,
  };
}

/** Adapts browser storage, anonymous auth, RPC and safe revision subscriptions. */
function createBrowserPort(client: SupabaseClient): SupabaseOnlinePort {
  return {
    async ensureAnonymousSession() {
      const { data } = await client.auth.getSession();
      if (data.session) return;
      const { error } = await client.auth.signInAnonymously();
      if (error) throw new Error("オンライン祝宴へ接続できません");
    },
    async rpc(functionName, args) {
      const { data, error } = await client.rpc(functionName, args);
      if (error) throw new Error(toJapaneseRpcError(error.message));
      return data;
    },
    rememberRoom(roomId) {
      rememberOnlineRoom(window.localStorage, roomId);
    },
    restoreRoomId() {
      return restoreOnlineRoomId(window.localStorage);
    },
    subscribe(roomId, onChange) {
      const channel = client
        .channel(`banquet-room:${roomId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
          () => void onChange(),
        )
        .subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}

/** Keeps server diagnostics out of the party UI while preserving intended messages. */
function toJapaneseRpcError(message: string): string {
  const intendedMessages = [
    "招待状を作成できません",
    "幹事だけが開宴できます",
    "幹事だけがクロッシュを開けられます",
    "幹事だけが次の皿へ進めます",
    "幹事だけが再戦を始められます",
    "全員の封蝋を待っています",
    "その予約札は封蝋済みです",
    "画面を更新してください",
  ];
  return intendedMessages.find((candidate) => message.includes(candidate)) ?? "オンライン祝宴で問題が起きました";
}
