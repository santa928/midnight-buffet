import { describe, expect, it } from "vitest";
import { createBidCards, createDishDeck } from "../../src/domain/decks";

describe("deck creation", () => {
  it("creates short feast reservation cards from 1 through 9", () => {
    expect(createBidCards("short")).toEqual(Array.from({ length: 9 }, (_, index) => index + 1));
  });

  it("creates full feast reservation cards from 1 through 15", () => {
    expect(createBidCards("full")).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
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
