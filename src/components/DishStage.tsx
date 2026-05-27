import type { ReactElement } from "react";
import { getDishPresentation } from "../assets/dishes";
import type { Dish } from "../domain/types";

interface DishStageProps {
  dish: Dish;
  concealed?: boolean;
}

/** Layers accessible scoring content over the generated serving-stage art. */
export function DishStage({ dish, concealed = false }: DishStageProps): ReactElement {
  const presentation = getDishPresentation(dish.points);

  return (
    <section className={`dish-stage ${presentation.tone}`} data-testid="dish-stage">
      {!concealed && (
        <>
          <img className="dish-art" src={presentation.asset} alt="" />
          <div className="dish-copy">
            <span className="tone-label">
              {presentation.tone === "delight" ? "ごちそう" : "厄介皿"}
            </span>
            <strong className="dish-points">
              {dish.points > 0 ? `+${dish.points}` : dish.points}
            </strong>
            <h2>{presentation.name}</h2>
            <p>{presentation.description}</p>
          </div>
        </>
      )}
    </section>
  );
}

