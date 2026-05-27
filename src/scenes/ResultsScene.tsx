import type { ReactElement } from "react";
import type { PublicSessionSnapshot } from "../session/types";
import { ScoreBoard } from "../components/ScoreBoard";

interface ResultsSceneProps {
  snapshot: PublicSessionSnapshot;
  onRematch: () => void;
  onReset: () => void;
}

/** Celebrates final rankings and exposes fast replay actions. */
export function ResultsScene({
  snapshot,
  onRematch,
  onReset,
}: ResultsSceneProps): ReactElement {
  const winners = snapshot.rankings?.filter(({ rank }) => rank === 1) ?? [];
  return (
    <section className="results-panel">
      <p className="section-label">今宵の表彰</p>
      <h1>{winners.map(({ name }) => name).join(" & ")} さんの勝利</h1>
      <ScoreBoard players={snapshot.players} />
      <button className="primary-action" onClick={onRematch} type="button">
        もう一度乾杯
      </button>
      <button className="secondary-action" onClick={onReset} type="button">
        設定へ戻る
      </button>
    </section>
  );
}
