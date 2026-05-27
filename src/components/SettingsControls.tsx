import type { ReactElement } from "react";

interface SettingsControlsProps {
  muted: boolean;
  reducedMotion: boolean;
  onToggleMute: () => void;
  onToggleMotion: () => void;
}

/** Exposes persistent accessibility controls without obscuring the stage. */
export function SettingsControls({
  muted,
  reducedMotion,
  onToggleMute,
  onToggleMotion,
}: SettingsControlsProps): ReactElement {
  return (
    <div className="settings-controls" aria-label="設定">
      <button className="icon-control" type="button" onClick={onToggleMute}>
        {muted ? "音を出す" : "音を消す"}
      </button>
      <button className="icon-control" type="button" onClick={onToggleMotion}>
        {reducedMotion ? "演出を戻す" : "演出を減らす"}
      </button>
    </div>
  );
}

