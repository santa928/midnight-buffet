import type { ReactElement } from "react";

interface HandoffSceneProps {
  playerName: string;
  onOpen: () => void;
}

/** Masks every private value while the phone changes hands. */
export function HandoffScene({ playerName, onOpen }: HandoffSceneProps): ReactElement {
  return (
    <section className="handoff-panel">
      <p className="section-label">端末を渡してください</p>
      <h1>次は {playerName} さん</h1>
      <p>画面を本人に向けてから、幕を開けてください。</p>
      <button className="primary-action" onClick={onOpen} type="button">
        手札を開く
      </button>
    </section>
  );
}
