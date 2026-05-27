import type { ReactElement } from "react";
import type { GameMode } from "../domain/types";

interface SetupSceneProps {
  mode: GameMode;
  names: string[];
  error?: string;
  onMode: (mode: GameMode) => void;
  onName: (index: number, name: string) => void;
  onAdd: () => void;
  onRemove: () => void;
  onStart: () => void;
}

/** Collects the guest list and selected feast duration. */
export function SetupScene({
  mode,
  names,
  error,
  onMode,
  onName,
  onAdd,
  onRemove,
  onStart,
}: SetupSceneProps): ReactElement {
  return (
    <section className="setup-panel">
      <div className="title-block">
        <p>Midnight Buffet</p>
        <h1>ごちそう合戦</h1>
        <span>最後のひと皿を、予約札で奪い合え。</span>
      </div>
      <div className="mode-picker" aria-label="試合モード">
        <button className={mode === "short" ? "active" : ""} onClick={() => onMode("short")} type="button">
          ショート9皿
          <small>約5分</small>
        </button>
        <button className={mode === "full" ? "active" : ""} onClick={() => onMode("full")} type="button">
          フル15皿
          <small>約10分</small>
        </button>
      </div>
      <div className="guest-list">
        <p className="section-label">招待客 2〜6人</p>
        {names.map((name, index) => (
          <label key={index}>
            <span>席 {index + 1}</span>
            <input
              aria-label={`プレイヤー ${index + 1} の名前`}
              maxLength={12}
              onChange={(event) => onName(index, event.target.value)}
              placeholder="名前"
              value={name}
            />
          </label>
        ))}
        <div className="guest-actions">
          <button disabled={names.length >= 6} onClick={onAdd} type="button">
            席を増やす
          </button>
          <button disabled={names.length <= 2} onClick={onRemove} type="button">
            席を減らす
          </button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-action" onClick={onStart} type="button">
        祝宴を始める
      </button>
    </section>
  );
}

