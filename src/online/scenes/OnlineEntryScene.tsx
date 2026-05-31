import { useState, type ReactElement } from "react";
import type { GameMode } from "../../domain/types";

interface OnlineEntrySceneProps {
  error?: string;
  busy: boolean;
  onBack: () => void;
  onCreate: (input: { displayName: string; mode: GameMode; passphrase: string }) => void;
  onJoin: (input: { displayName: string; inviteCode: string; passphrase: string }) => void;
}

type EntryAction = "create" | "join";

/** Collects only the invitation details required by protected room RPCs. */
export function OnlineEntryScene({
  error,
  busy,
  onBack,
  onCreate,
  onJoin,
}: OnlineEntrySceneProps): ReactElement {
  const [action, setAction] = useState<EntryAction>();
  const [displayName, setDisplayName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [mode, setMode] = useState<GameMode>("short");

  return (
    <section className="setup-panel online-entry-panel" data-testid="online-panel">
      <div className="title-block">
        <p>Invitation Hall</p>
        <h1>オンライン祝宴</h1>
        <span>招待状を手に、夜宴の控室へ。</span>
      </div>
      {!action && (
        <div className="style-actions">
          <button className="primary-action" onClick={() => setAction("create")} type="button">
            招待状を作る
          </button>
          <button className="invitation-action" onClick={() => setAction("join")} type="button">
            合言葉で入場
          </button>
        </div>
      )}
      {action === "create" && (
        <>
          <label className="online-field">
            <span>幹事の名前</span>
            <input
              aria-label="幹事の名前"
              maxLength={12}
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </label>
          <div className="mode-picker" aria-label="オンライン試合モード">
            <button className={mode === "short" ? "active" : ""} onClick={() => setMode("short")} type="button">
              ショート9皿
            </button>
            <button className={mode === "full" ? "active" : ""} onClick={() => setMode("full")} type="button">
              フル15皿
            </button>
          </div>
          <label className="online-field">
            <span>合言葉</span>
            <input
              aria-label="合言葉"
              maxLength={48}
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </label>
          <button
            className="primary-action"
            disabled={busy}
            onClick={() => onCreate({ displayName, mode, passphrase })}
            type="button"
          >
            招待状を発行する
          </button>
        </>
      )}
      {action === "join" && (
        <>
          <label className="online-field">
            <span>招待コード</span>
            <input
              aria-label="招待コード"
              autoCapitalize="characters"
              maxLength={10}
              onChange={(event) => setInviteCode(event.target.value)}
              value={inviteCode}
            />
          </label>
          <label className="online-field">
            <span>あなたの名前</span>
            <input
              aria-label="あなたの名前"
              maxLength={12}
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </label>
          <label className="online-field">
            <span>合言葉</span>
            <input
              aria-label="合言葉"
              maxLength={48}
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </label>
          <button
            className="primary-action"
            disabled={busy}
            onClick={() => onJoin({ displayName, inviteCode, passphrase })}
            type="button"
          >
            控室へ入る
          </button>
        </>
      )}
      <p className="privacy-caption">合言葉は口頭で伝え、公開画面には残しません。</p>
      {error && <p className="form-error">{error}</p>}
      <button className="secondary-action" onClick={onBack} type="button">
        入口へ戻る
      </button>
    </section>
  );
}
