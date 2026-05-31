import type { ReactElement } from "react";

interface PlayStyleSceneProps {
  onlineAvailable: boolean;
  onOffline: () => void;
  onOnline: () => void;
}

/** Opens either a pass-around feast or the invitation-based online banquet. */
export function PlayStyleScene({ onlineAvailable, onOffline, onOnline }: PlayStyleSceneProps): ReactElement {
  return (
    <section className="setup-panel launch-panel">
      <div className="title-block">
        <p>Midnight Buffet</p>
        <h1>ごちそう合戦</h1>
        <span>最後のひと皿を、予約札で奪い合え。</span>
      </div>
      <div className="style-actions">
        <button className="primary-action" onClick={onOffline} type="button">
          この端末で遊ぶ
          <small>端末を渡して 2〜6人</small>
        </button>
        <button className="invitation-action" disabled={!onlineAvailable} onClick={onOnline} type="button">
          オンライン祝宴
          <small>{onlineAvailable ? "招待状と合言葉で入場" : "Vercel版で開場予定"}</small>
        </button>
      </div>
    </section>
  );
}
