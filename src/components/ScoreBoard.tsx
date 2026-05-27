import type { ReactElement } from "react";
import type { PublicPlayerSnapshot } from "../session/types";

interface ScoreBoardProps {
  players: PublicPlayerSnapshot[];
}

/** Presents public totals only, never hidden reservation values. */
export function ScoreBoard({ players }: ScoreBoardProps): ReactElement {
  return (
    <div className="scoreboard" aria-label="得点表">
      {players.map((player) => (
        <div className="score-seat" key={player.id}>
          <span>{player.name}</span>
          <strong>{player.score > 0 ? `+${player.score}` : player.score}</strong>
        </div>
      ))}
    </div>
  );
}

