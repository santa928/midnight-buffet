import type { BidValue, Dish, GameMode } from "./types";

type Shuffler<T> = (values: T[]) => T[];

/** Creates the shared hand of one-use numbered reservation cards. */
export function createBidCards(): BidValue[] {
  return Array.from({ length: 15 }, (_, index) => index + 1);
}

/** Creates the selected feast's dishes in a shuffled order. */
export function createDishDeck(
  mode: GameMode,
  shuffle: Shuffler<Dish> = shuffleValues,
): Dish[] {
  const positiveLimit = mode === "short" ? 6 : 10;
  const negativeLimit = mode === "short" ? 3 : 5;
  const points = [
    ...Array.from({ length: positiveLimit }, (_, index) => index + 1),
    ...Array.from({ length: negativeLimit }, (_, index) => -(index + 1)),
  ];

  return shuffle(
    points.map((value) => ({
      id: `dish-${value > 0 ? "plus" : "minus"}-${Math.abs(value)}`,
      points: value,
      kind: value > 0 ? "positive" : "negative",
    })),
  );
}

/** Randomizes a copied array while retaining the original value list. */
function shuffleValues<T>(values: T[]): T[] {
  const randomized = [...values];
  for (let index = randomized.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [randomized[index], randomized[swapIndex]] = [randomized[swapIndex], randomized[index]];
  }
  return randomized;
}
