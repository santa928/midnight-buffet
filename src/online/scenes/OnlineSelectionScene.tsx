import type { ReactElement } from "react";
import { DishStage } from "../../components/DishStage";
import { ReservationCard } from "../../components/ReservationCard";
import type { OnlinePrivateHand } from "../types";

interface OnlineSelectionSceneProps {
  hand: OnlinePrivateHand;
  selectedBid?: number;
  busy: boolean;
  onSeal: () => void;
  onSelect: (bid: number) => void;
}

/** Renders only the current authenticated player's unsealed hand. */
export function OnlineSelectionScene({
  hand,
  selectedBid,
  busy,
  onSeal,
  onSelect,
}: OnlineSelectionSceneProps): ReactElement {
  return (
    <>
      <DishStage dish={hand.dish} />
      <section className="private-hand online-private-hand" data-testid="card-hand">
        <p className="private-caption">{hand.displayName} さんの予約札</p>
        <div className="cards-scroll">
          {hand.remainingBids.map((value) => (
            <ReservationCard key={value} onSelect={onSelect} selected={value === selectedBid} value={value} />
          ))}
        </div>
        <button
          className="primary-action"
          data-testid="primary-cta"
          disabled={selectedBid === undefined || busy}
          onClick={onSeal}
          type="button"
        >
          この札を封蝋する
        </button>
      </section>
    </>
  );
}
