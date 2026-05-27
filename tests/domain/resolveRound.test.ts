import { describe, expect, it } from "vitest";
import { resolveRound } from "../../src/domain/resolveRound";

describe("resolveRound", () => {
  it("awards a positive dish to the highest unique reservation", () => {
    const result = resolveRound(
      { id: "dessert", points: 7, kind: "positive" },
      [
        { playerId: "a", bid: 12 },
        { playerId: "b", bid: 9 },
      ],
    );

    expect(result.winnerId).toBe("a");
  });

  it("awards a negative dish to the lowest unique reservation", () => {
    const result = resolveRound(
      { id: "burnt", points: -4, kind: "negative" },
      [
        { playerId: "a", bid: 12 },
        { playerId: "b", bid: 3 },
      ],
    );

    expect(result.winnerId).toBe("b");
  });

  it("removes matching values before selecting the positive winner", () => {
    const result = resolveRound(
      { id: "tart", points: 8, kind: "positive" },
      [
        { playerId: "a", bid: 12 },
        { playerId: "b", bid: 12 },
        { playerId: "c", bid: 7 },
      ],
    );

    expect(result.winnerId).toBe("c");
    expect(result.collidedBids).toEqual([12]);
  });

  it("leaves the dish unserved when every reservation collides", () => {
    const result = resolveRound(
      { id: "parfait", points: 4, kind: "positive" },
      [
        { playerId: "a", bid: 5 },
        { playerId: "b", bid: 5 },
      ],
    );

    expect(result.winnerId).toBeNull();
    expect(result.unserved).toBe(true);
  });
});
