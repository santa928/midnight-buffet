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
  onBack?: () => void;
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
  onBack,
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
      <section className="how-to-panel" aria-labelledby="how-to-title">
        <h2 id="how-to-title">遊び方</h2>
        <ol>
          <li>端末を次の招待客へ渡し、本人だけが手札を開きます。</li>
          <li>予約札は1回だけ使えます。ショート9皿では1〜9、フル15皿では1〜15を使います。</li>
          <li>全員が封蝋したらクロッシュを開き、同じ数字は取り合いで無効になります。</li>
          <li>ごちそうは単独で一番大きい札、厄介皿は単独で一番小さい札が獲得します。</li>
        </ol>
      </section>
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
      {onBack && (
        <button className="secondary-action" onClick={onBack} type="button">
          入口へ戻る
        </button>
      )}
    </section>
  );
}
