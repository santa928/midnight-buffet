import type { ReactElement } from "react";
import type { PrivateTurnSnapshot } from "../session/types";
import { DishStage } from "../components/DishStage";
import { ReservationCard } from "../components/ReservationCard";

interface SelectionSceneProps {
  turn: PrivateTurnSnapshot;
  selectedBid?: number;
  onSelect: (value: number) => void;
  onSeal: () => void;
}

/** Shows a private hand only to the active guest. */
export function SelectionScene({
  turn,
  selectedBid,
  onSelect,
  onSeal,
}: SelectionSceneProps): ReactElement {
  return (
    <>
      <DishStage dish={turn.dish} />
      <section className="private-hand" data-testid="card-hand">
        <p className="private-caption">{turn.playerName} さんの予約札</p>
        <div className="cards-scroll">
          {turn.remainingBids.map((value) => (
            <ReservationCard
              key={value}
              onSelect={onSelect}
              selected={value === selectedBid}
              value={value}
            />
          ))}
        </div>
        <button
          className="primary-action"
          data-testid="primary-cta"
          disabled={selectedBid === undefined}
          onClick={onSeal}
          type="button"
        >
          この札を封蝋する
        </button>
      </section>
    </>
  );
}

