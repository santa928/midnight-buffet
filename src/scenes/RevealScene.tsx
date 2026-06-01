import type { ReactElement } from "react";
import { DishStage } from "../components/DishStage";
import { ScoreBoard } from "../components/ScoreBoard";
import type { PublicSessionSnapshot } from "../session/types";

interface RevealSceneProps {
  snapshot: PublicSessionSnapshot;
  onReveal: () => void;
  onAdvance: () => void;
}

/** Turns sealed reservations into the public celebration and score result. */
export function RevealScene({
  snapshot,
  onReveal,
  onAdvance,
}: RevealSceneProps): ReactElement {
  if (!snapshot.currentDish && snapshot.phase !== "revealed") {
    return <></>;
  }

  if (snapshot.phase === "reveal-ready" && snapshot.currentDish) {
    return (
      <>
        <DishStage dish={snapshot.currentDish} concealed />
        <section className="reveal-ready">
          <h1>全員の予約札が揃いました</h1>
          <button className="primary-action" onClick={onReveal} type="button">
            クロッシュを開ける
          </button>
        </section>
      </>
    );
  }

  const outcome = snapshot.revealedOutcome;
  if (!outcome) {
    return <></>;
  }
  const winner = snapshot.players.find((player) => player.id === outcome.winnerId);
  const advanceLabel = snapshot.currentDish ? "次の皿へ" : "結果を見る";

  return (
    <>
      <DishStage dish={outcome.dish} />
      <section className="reveal-result">
        <h1>{winner ? `${winner.name} さんが獲得` : "この皿は未配膳"}</h1>
        <div className="revealed-cards" aria-label="公開された予約札">
          {outcome.selections.map((selection) => (
            <span className={outcome.collidedBids.includes(selection.bid) ? "collided" : ""} key={selection.playerId}>
              {selection.bid}
            </span>
          ))}
        </div>
        <ScoreBoard players={snapshot.players} />
        <button className="primary-action" onClick={onAdvance} type="button">
          {advanceLabel}
        </button>
      </section>
    </>
  );
}
