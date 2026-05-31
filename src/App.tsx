import { lazy, Suspense, useState, type ReactElement } from "react";
import { Hud } from "./components/Hud";
import { OfflineBanquet } from "./offline/OfflineBanquet";
import { restoreOnlineRoomId } from "./online/roomStorage";
import { hasSupabasePublicConfig } from "./online/supabasePublicConfig";
import { PlayStyleScene } from "./scenes/PlayStyleScene";
import type { DishShuffler } from "./session/types";
import type { OnlineRoomGateway } from "./online/onlineRoomGateway";
import "./styles/game.css";

const OnlineBanquet = lazy(async () => {
  const module = await import("./online/OnlineBanquet");
  return { default: module.OnlineBanquet };
});

interface AppProps {
  shuffle?: DishShuffler;
  onlineGatewayFactory?: () => Promise<OnlineRoomGateway>;
}

type PlayStyle = "offline" | "online";

/** Selects a banquet style while keeping the online SDK outside offline startup. */
export function App({ shuffle, onlineGatewayFactory }: AppProps): ReactElement {
  const rememberedOnlineRoomId = restoreOnlineRoomId(window.localStorage);
  const onlineAvailable =
    Boolean(onlineGatewayFactory) || Boolean(rememberedOnlineRoomId) || hasSupabasePublicConfig(import.meta.env);
  const [playStyle, setPlayStyle] = useState<PlayStyle | undefined>(() => (rememberedOnlineRoomId ? "online" : undefined));
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  if (playStyle === "offline") {
    return <OfflineBanquet onExit={() => setPlayStyle(undefined)} shuffle={shuffle} />;
  }
  if (playStyle === "online") {
    return (
      <Suspense fallback={<LoadingOnlineBanquet />}>
        <OnlineBanquet gatewayFactory={onlineGatewayFactory} onExit={() => setPlayStyle(undefined)} />
      </Suspense>
    );
  }

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
      />
      <div className="scene-surface">
        <PlayStyleScene
          onlineAvailable={onlineAvailable}
          onOffline={() => setPlayStyle("offline")}
          onOnline={() => setPlayStyle("online")}
        />
      </div>
    </main>
  );
}

/** Keeps the invitation transition within the banquet visual frame. */
function LoadingOnlineBanquet(): ReactElement {
  return (
    <main className="game-app">
      <img
        alt=""
        aria-hidden="true"
        className="banquet-background"
        src={`${import.meta.env.BASE_URL}assets/backgrounds/banquet-stage.webp`}
      />
      <div className="scene-surface">
        <section className="setup-panel reconnect-panel">
          <p className="section-label">招待状を開封中</p>
          <h1>オンライン祝宴へ向かっています</h1>
        </section>
      </div>
    </main>
  );
}
