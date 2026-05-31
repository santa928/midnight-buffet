import type { ReactElement } from "react";
import type { OnlineRoomSnapshot } from "../types";

interface LobbySceneProps {
  busy: boolean;
  snapshot: OnlineRoomSnapshot;
  onExit: () => void;
  onStart: () => void;
}

/** Shows the spoken-invitation waiting room and host-only start control. */
export function LobbyScene({ busy, snapshot, onExit, onStart }: LobbySceneProps): ReactElement {
  const canStart = snapshot.isHost && snapshot.members.length >= 2 && !busy;
  return (
    <section className="online-panel lobby-panel" data-testid="online-panel">
      <p className="section-label">招待状 / 控室</p>
      <h1>オンライン祝宴</h1>
      <div className="invitation-code">
        <span>招待コード</span>
        <strong>{snapshot.inviteCode}</strong>
      </div>
      <p className="privacy-caption">合言葉は口頭で伝え、画面には表示しません。</p>
      <div className="lobby-members" aria-label="待機中の招待客">
        {snapshot.members.map((member) => (
          <div className="lobby-member" key={member.id}>
            <span>{member.displayName}</span>
            <small>{member.seatIndex === 0 ? "幹事" : "待機中"}</small>
          </div>
        ))}
      </div>
      {snapshot.isHost ? (
        <button className="primary-action" disabled={!canStart} onClick={onStart} type="button">
          開宴する
        </button>
      ) : (
        <p className="waiting-caption">幹事がクロッシュを整えています</p>
      )}
      <button className="secondary-action" onClick={onExit} type="button">
        入口へ戻る
      </button>
    </section>
  );
}
