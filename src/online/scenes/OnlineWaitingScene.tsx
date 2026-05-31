import type { ReactElement } from "react";
import { DishStage } from "../../components/DishStage";
import type { OnlineRoomSnapshot } from "../types";

interface OnlineWaitingSceneProps {
  busy: boolean;
  snapshot: OnlineRoomSnapshot;
  onReveal: () => void;
}

/** Hides sealed values while revealing who has completed their wax seal. */
export function OnlineWaitingScene({ busy, snapshot, onReveal }: OnlineWaitingSceneProps): ReactElement {
  const allSealed = snapshot.members.every(({ sealed }) => sealed);
  if (!snapshot.currentDish) return <></>;
  return (
    <>
      <DishStage concealed dish={snapshot.currentDish} />
      <section className="online-panel seal-status" data-testid="online-panel">
        <p className="section-label">封蝋待ち</p>
        <div className="seal-members">
          {snapshot.members.map((member) => (
            <p className={`seal-member ${member.sealed ? "sealed" : ""}`} key={member.id}>
              <span>{member.displayName}</span>
              <strong>{member.sealed ? "封蝋済み" : "選択中"}</strong>
            </p>
          ))}
        </div>
        {snapshot.isHost && (
          <button className="primary-action" disabled={!allSealed || busy} onClick={onReveal} type="button">
            クロッシュを開ける
          </button>
        )}
        {!snapshot.isHost && allSealed && <p className="waiting-caption">幹事の公開を待っています</p>}
      </section>
    </>
  );
}
