import { describe, expect, it } from "vitest";
import { createGame, getRankings, playRound, rematch } from "../../src/domain/game";

const ordered = <T>(values: T[]): T[] => values;

describe("game lifecycle", () => {
  it("starts a short feast with two guests and nine dishes", () => {
    const game = createGame("short", ["あおい", "れん"], ordered);

    expect(game.players).toHaveLength(2);
    expect(game.dishes).toHaveLength(9);
    expect(game.currentDish?.points).toBe(1);
    expect(game.finished).toBe(false);
  });

  it("awards a served dish and consumes each reservation card", () => {
    const game = createGame("short", ["あおい", "れん"], ordered);

    const next = playRound(game, [
      { playerId: game.players[0].id, bid: 9 },
      { playerId: game.players[1].id, bid: 2 },
    ]);

    expect(next.players[0].score).toBe(1);
    expect(next.players[0].remainingBids).not.toContain(9);
    expect(next.players[1].remainingBids).not.toContain(2);
    expect(next.currentDish?.points).toBe(2);
  });

  it("prevents a guest from reusing a sealed reservation card", () => {
    const game = createGame("short", ["あおい", "れん"], ordered);
    const once = playRound(game, [
      { playerId: game.players[0].id, bid: 9 },
      { playerId: game.players[1].id, bid: 8 },
    ]);

    expect(() =>
      playRound(once, [
        { playerId: once.players[0].id, bid: 9 },
        { playerId: once.players[1].id, bid: 7 },
      ]),
    ).toThrow("使用済みの予約札です");
  });

  it("finishes after nine short rounds and keeps tied rankings together", () => {
    let game = createGame("short", ["あおい", "れん"], ordered);

    for (let round = 0; round < 9; round += 1) {
      const bid = round + 1;
      game = playRound(game, [
        { playerId: game.players[0].id, bid },
        { playerId: game.players[1].id, bid },
      ]);
    }

    expect(game.finished).toBe(true);
    expect(game.currentDish).toBeUndefined();
    expect(getRankings(game.players).map(({ rank }) => rank)).toEqual([1, 1]);
  });

  it("starts a rematch with fresh hands and no captured dishes", () => {
    const game = createGame("short", ["あおい", "れん"], ordered);
    const scored = playRound(game, [
      { playerId: game.players[0].id, bid: 9 },
      { playerId: game.players[1].id, bid: 1 },
    ]);

    const replay = rematch(scored, ordered);

    expect(replay.players[0].remainingBids).toHaveLength(9);
    expect(replay.players[0].score).toBe(0);
    expect(replay.history).toEqual([]);
    expect(replay.currentDish?.points).toBe(1);
  });
});
