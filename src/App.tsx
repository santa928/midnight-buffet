import { useState, type ReactElement } from "react";
import { useCelebrationAudio } from "./audio/useCelebrationAudio";
import { Hud } from "./components/Hud";
import type { GameMode } from "./domain/types";
import { HandoffScene } from "./scenes/HandoffScene";
import { ResultsScene } from "./scenes/ResultsScene";
import { RevealScene } from "./scenes/RevealScene";
import { SelectionScene } from "./scenes/SelectionScene";
import { SetupScene } from "./scenes/SetupScene";
import { createLocalSessionAdapter } from "./session/localSessionAdapter";
import type {
  DishShuffler,
  PrivateTurnSnapshot,
  PublicSessionSnapshot,
  SessionAdapter,
} from "./session/types";
import "./styles/game.css";

interface AppProps {
  shuffle?: DishShuffler;
}

/** Coordinates the offline banquet scenes through the session adapter boundary. */
export function App({ shuffle }: AppProps): ReactElement {
  const [mode, setMode] = useState<GameMode>("short");
  const [names, setNames] = useState(["", ""]);
  const [error, setError] = useState<string>();
  const [adapter, setAdapter] = useState<SessionAdapter>();
  const [snapshot, setSnapshot] = useState<PublicSessionSnapshot>();
  const [privateTurn, setPrivateTurn] = useState<PrivateTurnSnapshot>();
  const [selectedBid, setSelectedBid] = useState<number>();
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const playSound = useCelebrationAudio(muted);

  function startFeast(): void {
    try {
      const nextAdapter = createLocalSessionAdapter({ mode, names, shuffle });
      setAdapter(nextAdapter);
      setSnapshot(nextAdapter.getSnapshot());
      setError(undefined);
      playSound("bell");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "祝宴を開始できません");
    }
  }

  function openHand(): void {
    if (!adapter) return;
    setPrivateTurn(adapter.openCurrentHand());
    setSnapshot(adapter.getSnapshot());
  }

  function sealSelectedCard(): void {
    if (!adapter || selectedBid === undefined) return;
    setSnapshot(adapter.sealCard(selectedBid));
    setPrivateTurn(undefined);
    setSelectedBid(undefined);
    playSound("seal");
  }

  function reveal(): void {
    if (!adapter) return;
    const revealed = adapter.revealRound();
    setSnapshot(revealed);
    const hasCollision = (revealed.revealedOutcome?.collidedBids.length ?? 0) > 0;
    playSound(hasCollision ? "collision" : "cloche");
  }

  function advance(): void {
    if (!adapter) return;
    setSnapshot(adapter.advanceRound());
  }

  function rematch(): void {
    if (!adapter) return;
    setSnapshot(adapter.rematch());
    playSound("bell");
  }

  function resetSetup(): void {
    setAdapter(undefined);
    setSnapshot(undefined);
    setPrivateTurn(undefined);
    setSelectedBid(undefined);
  }

  const scene = snapshot?.phase;

  return (
    <main className={`game-app ${reducedMotion ? "reduced-motion" : ""}`}>
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
        snapshot={snapshot}
      />
      <div className="scene-surface">
        {!snapshot && (
          <SetupScene
            error={error}
            mode={mode}
            names={names}
            onAdd={() => setNames((values) => [...values, ""])}
            onMode={setMode}
            onName={(index, name) =>
              setNames((values) => values.map((value, current) => (current === index ? name : value)))
            }
            onRemove={() => setNames((values) => values.slice(0, -1))}
            onStart={startFeast}
          />
        )}
        {snapshot && scene === "handoff" && snapshot.currentPlayerName && (
          <HandoffScene onOpen={openHand} playerName={snapshot.currentPlayerName} />
        )}
        {snapshot && scene === "selecting" && privateTurn && (
          <SelectionScene
            onSeal={sealSelectedCard}
            onSelect={setSelectedBid}
            selectedBid={selectedBid}
            turn={privateTurn}
          />
        )}
        {snapshot && (scene === "reveal-ready" || scene === "revealed") && (
          <RevealScene onAdvance={advance} onReveal={reveal} snapshot={snapshot} />
        )}
        {snapshot && scene === "finished" && (
          <ResultsScene onRematch={rematch} onReset={resetSetup} snapshot={snapshot} />
        )}
      </div>
    </main>
  );
}
