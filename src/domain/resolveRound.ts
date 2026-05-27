import type { BidValue, Dish, RoundOutcome, Selection } from "./types";

/** Resolves one revealed dish after removing all duplicated reservation values. */
export function resolveRound(dish: Dish, selections: Selection[]): RoundOutcome {
  const counts = new Map<BidValue, number>();
  selections.forEach(({ bid }) => counts.set(bid, (counts.get(bid) ?? 0) + 1));

  const collidedBids = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([bid]) => bid)
    .sort((left, right) => left - right);
  const eligible = selections.filter(({ bid }) => !collidedBids.includes(bid));

  if (eligible.length === 0) {
    return {
      dish,
      selections,
      collidedBids,
      winnerId: null,
      unserved: true,
    };
  }

  const winner = eligible.reduce((chosen, contender) => {
    if (dish.kind === "positive") {
      return contender.bid > chosen.bid ? contender : chosen;
    }
    return contender.bid < chosen.bid ? contender : chosen;
  });

  return {
    dish,
    selections,
    collidedBids,
    winnerId: winner.playerId,
    unserved: false,
  };
}
