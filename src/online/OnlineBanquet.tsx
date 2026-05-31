import { useEffect, useState, type ReactElement } from "react";
import { useCelebrationAudio } from "../audio/useCelebrationAudio";
import { DishStage } from "../components/DishStage";
import { Hud } from "../components/Hud";
import { ScoreBoard } from "../components/ScoreBoard";
import type { PublicSessionSnapshot } from "../session/types";
import type { OnlineRoomGateway } from "./onlineRoomGateway";
import { createBrowserOnlineRoomGateway } from "./supabaseOnlineRoomGateway";
import type { OnlinePrivateHand, OnlineRoomSnapshot } from "./types";
import { LobbyScene } from "./scenes/LobbyScene";
import { OnlineEntryScene } from "./scenes/OnlineEntryScene";
import { OnlineSelectionScene } from "./scenes/OnlineSelectionScene";
import { OnlineWaitingScene } from "./scenes/OnlineWaitingScene";

interface OnlineBanquetProps {
  onExit: () => void;
  gatewayFactory?: () => Promise<OnlineRoomGateway>;
}

/** Orchestrates a private multi-device banquet through snapshot-only RPC state. */
export function OnlineBanquet({
  onExit,
  gatewayFactory = createBrowserOnlineRoomGateway,
}: OnlineBanquetProps): ReactElement {
  const [gateway, setGateway] = useState<OnlineRoomGateway>();
  const [snapshot, setSnapshot] = useState<OnlineRoomSnapshot>();
  const [hand, setHand] = useState<OnlinePrivateHand>();
  const [selectedBid, setSelectedBid] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string>();
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const playSound = useCelebrationAudio(muted);
  const roomId = snapshot?.roomId;
  const phase = snapshot?.phase;
  const revision = snapshot?.revision;
  const mySeatIsSealed = snapshot?.members.find(({ isMe }) => isMe)?.sealed;

  useEffect(() => {
    let active = true;
    void gatewayFactory()
      .then(async (created) => {
        if (!active) return;
        setGateway(created);
        const recovered = await created.restoreRoom();
        if (!active) return;
        setSnapshot(recovered);
        setRestored(Boolean(recovered));
        setConnecting(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(errorMessage(cause));
        setConnecting(false);
      });
    return () => {
      active = false;
    };
  }, [gatewayFactory]);

  useEffect(() => {
    if (!gateway || !roomId) return undefined;
    return gateway.subscribe(roomId, (next) => {
      setSnapshot(next);
    });
  }, [gateway, roomId]);

  useEffect(() => {
    if (!gateway || !roomId || phase !== "selecting" || mySeatIsSealed) {
      setHand(undefined);
      setSelectedBid(undefined);
      return;
    }
    let active = true;
    void gateway
      .getMyHand(roomId)
      .then((next) => {
        if (active) setHand(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [gateway, roomId, phase, revision, mySeatIsSealed]);

  async function perform(action: () => Promise<OnlineRoomSnapshot>, sound?: "bell" | "seal" | "cloche"): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const next = await action();
      setSnapshot(next);
      setSelectedBid(undefined);
      if (sound) playSound(sound);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const sharedSnapshot = snapshot && snapshot.phase !== "lobby" ? toPublicSnapshot(snapshot) : undefined;
  return (
    <main className={`game-app online-app ${reducedMotion ? "reduced-motion" : ""}`}>
      <img
        alt=""
        aria-hidden="true"
        className="banquet-background"
        src={`${import.meta.env.BASE_URL}assets/backgrounds/banquet-stage.webp`}
      />
      <Hud
        muted={muted}
        onToggleMotion={() => setReducedMotion((value) => !value)}
        onToggleMute={() => setMuted((value) => !value)}
        reducedMotion={reducedMotion}
        snapshot={sharedSnapshot}
      />
      <div className="scene-surface">
        {connecting && (
          <section className="online-panel reconnect-panel">
            <p className="section-label">招待状を確認中</p>
            <h1>控室へ向かっています</h1>
          </section>
        )}
        {!connecting && !snapshot && gateway && (
          <OnlineEntryScene
            busy={busy}
            error={error}
            onBack={onExit}
            onCreate={(input) => void perform(() => gateway.createRoom(input), "bell")}
            onJoin={(input) => void perform(() => gateway.joinRoom(input), "bell")}
          />
        )}
        {!connecting && !snapshot && !gateway && (
          <OnlineUnavailablePanel error={error ?? "オンライン祝宴を開けませんでした"} onBack={onExit} />
        )}
        {restored && snapshot && <p className="reconnect-toast">席へ戻りました</p>}
        {snapshot?.phase === "lobby" && gateway && (
          <LobbyScene
            busy={busy}
            onExit={onExit}
            onStart={() => void perform(() => gateway.startRoom(snapshot.roomId), "bell")}
            snapshot={snapshot}
          />
        )}
        {snapshot?.phase === "selecting" && hand && gateway && (
          <OnlineSelectionScene
            busy={busy}
            hand={hand}
            onSeal={() => {
              if (selectedBid !== undefined) {
                void perform(() => gateway.sealBid(snapshot.roomId, selectedBid, snapshot.roundIndex), "seal");
              }
            }}
            onSelect={setSelectedBid}
            selectedBid={selectedBid}
          />
        )}
        {snapshot?.phase === "selecting" && !hand && gateway && (
          <OnlineWaitingScene
            busy={busy}
            onReveal={() => void perform(() => gateway.revealRound(snapshot.roomId), "cloche")}
            snapshot={snapshot}
          />
        )}
        {snapshot?.phase === "revealed" && gateway && (
          <OnlineRevealPanel
            busy={busy}
            onAdvance={() => void perform(() => gateway.advanceRound(snapshot.roomId), "bell")}
            snapshot={snapshot}
          />
        )}
        {snapshot?.phase === "finished" && gateway && (
          <OnlineResultsPanel
            busy={busy}
            onExit={onExit}
            onRematch={() => void perform(() => gateway.rematch(snapshot.roomId), "bell")}
            snapshot={snapshot}
          />
        )}
        {snapshot && error && <p className="form-error online-error">{error}</p>}
      </div>
    </main>
  );
}

interface OnlineUnavailablePanelProps {
  error: string;
  onBack: () => void;
}

/** Keeps failed online setup recoverable instead of leaving a blank banquet surface. */
function OnlineUnavailablePanel({ error, onBack }: OnlineUnavailablePanelProps): ReactElement {
  return (
    <section className="online-panel reconnect-panel">
      <p className="section-label">招待状を確認できません</p>
      <h1>オンライン祝宴はまだ開場していません</h1>
      <p>{error}</p>
      <button className="secondary-action" onClick={onBack} type="button">
        入口へ戻る
      </button>
    </section>
  );
}

interface ProgressPanelProps {
  busy: boolean;
  snapshot: OnlineRoomSnapshot;
}

interface RevealPanelProps extends ProgressPanelProps {
  onAdvance: () => void;
}

/** Displays revealed values only after the server has committed the outcome. */
function OnlineRevealPanel({ busy, onAdvance, snapshot }: RevealPanelProps): ReactElement {
  const outcome = snapshot.revealedOutcome;
  if (!outcome) return <></>;
  const winner = snapshot.members.find(({ id }) => id === outcome.winnerId);
  return (
    <>
      <DishStage dish={outcome.dish} />
      <section className="reveal-result online-panel" data-testid="online-panel">
        <h1>{winner ? `${winner.displayName} さんが獲得` : "この皿は未配膳"}</h1>
        <div className="revealed-cards" aria-label="公開された予約札">
          {outcome.selections.map((selection) => (
            <span className={outcome.collidedBids.includes(selection.bid) ? "collided" : ""} key={selection.playerId}>
              {selection.bid}
            </span>
          ))}
        </div>
        <ScoreBoard players={toPublicSnapshot(snapshot).players} />
        {snapshot.isHost ? (
          <button
            className="primary-action"
            disabled={busy}
            onClick={onAdvance}
            type="button"
          >
            次の皿へ
          </button>
        ) : (
          <p className="waiting-caption">幹事が次の皿を選びます</p>
        )}
      </section>
    </>
  );
}

interface ResultsPanelProps extends ProgressPanelProps {
  onExit: () => void;
  onRematch: () => void;
}

/** Shows online awards and exposes rematch only to the host. */
function OnlineResultsPanel({ busy, onExit, onRematch, snapshot }: ResultsPanelProps): ReactElement {
  const winners = snapshot.rankings?.filter(({ rank }) => rank === 1) ?? [];
  return (
    <section className="results-panel online-panel" data-testid="online-panel">
      <p className="section-label">今宵の表彰</p>
      <h1>{winners.map(({ displayName }) => displayName).join(" & ")} さんの勝利</h1>
      <ScoreBoard players={toPublicSnapshot(snapshot).players} />
      {snapshot.isHost && (
        <button
          className="primary-action"
          disabled={busy}
          onClick={onRematch}
          type="button"
        >
          もう一度乾杯
        </button>
      )}
      <button className="secondary-action" onClick={onExit} type="button">
        入口へ戻る
      </button>
    </section>
  );
}

/** Converts online member scores into the shared HUD and scoreboard representation. */
function toPublicSnapshot(snapshot: OnlineRoomSnapshot): PublicSessionSnapshot {
  return {
    mode: snapshot.mode,
    phase: snapshot.phase === "lobby" ? "handoff" : snapshot.phase,
    roundNumber: snapshot.roundNumber,
    dishCount: snapshot.dishCount,
    currentDish: snapshot.currentDish,
    players: snapshot.members.map((member) => ({
      id: member.id,
      name: member.displayName,
      score: member.score,
      capturedDishes: [],
      remainingBidCount: 0,
    })),
    revealedOutcome: snapshot.revealedOutcome,
    rankings: snapshot.rankings?.map((ranking) => ({
      id: ranking.id,
      name: ranking.displayName,
      score: ranking.score,
      rank: ranking.rank,
      capturedDishes: [],
      remainingBids: [],
    })),
  };
}

/** Converts connection and RPC failures to party-facing guidance. */
function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "オンライン祝宴へ接続できません";
}
