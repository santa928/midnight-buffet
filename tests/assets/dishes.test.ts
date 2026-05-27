import { describe, expect, it } from "vitest";
import { getDishPresentation } from "../../src/assets/dishes";

describe("dish presentation catalog", () => {
  it("defines readable presentation for every full-feast score value", () => {
    const values = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    values.forEach((points) => {
      const dish = getDishPresentation(points);
      expect(dish.name.length).toBeGreaterThan(0);
      expect(dish.asset).toMatch(/\.webp$/);
      expect(dish.tone).toBe(points > 0 ? "delight" : "trouble");
    });
  });

  it("keeps trouble-dish copy aligned with the transformed tart artwork", () => {
    [-5, -4, -3, -2, -1].forEach((points) => {
      expect(getDishPresentation(points).name).toContain("タルト");
    });
  });
});
