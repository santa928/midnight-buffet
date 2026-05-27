import type { ReactElement } from "react";
import type { PublicSessionSnapshot } from "../session/types";
import { SettingsControls } from "./SettingsControls";

interface HudProps {
  snapshot?: PublicSessionSnapshot;
  muted: boolean;
  reducedMotion: boolean;
  onToggleMute: () => void;
  onToggleMotion: () => void;
}

/** Shows shared feast progress plus audio and motion preferences. */
export function Hud({
  snapshot,
  muted,
  reducedMotion,
  onToggleMute,
  onToggleMotion,
}: HudProps): ReactElement {
  return (
    <header className="hud">
      <div className="brand-mini">
        <span className="brand-emblem" aria-hidden="true">
          M
        </span>
        <div>
          <strong>ごちそう合戦</strong>
          {snapshot && (
            <span className="round-label">
              {snapshot.mode === "short" ? "ショート" : "フル"} {snapshot.roundNumber}/
              {snapshot.dishCount}皿
            </span>
          )}
        </div>
      </div>
      <SettingsControls
        muted={muted}
        reducedMotion={reducedMotion}
        onToggleMute={onToggleMute}
        onToggleMotion={onToggleMotion}
      />
    </header>
  );
}

