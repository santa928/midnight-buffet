import { describe, expect, it } from "vitest";
import { createBidCards, createDishDeck } from "../../src/domain/decks";

describe("deck creation", () => {
  it("creates one reservation card for every value from 1 through 15", () => {
    expect(createBidCards()).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
  });

  it("creates the nine dishes for a short feast", () => {
    const deck = createDishDeck("short", (values) => values);

    expect(deck.map((dish) => dish.points)).toEqual([1, 2, 3, 4, 5, 6, -1, -2, -3]);
  });

  it("creates the fifteen dishes for a full feast", () => {
    const deck = createDishDeck("full", (values) => values);

    expect(deck.map((dish) => dish.points)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1, -2, -3, -4, -5,
    ]);
  });
});
