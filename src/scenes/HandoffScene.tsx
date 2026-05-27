import { useEffect, useRef, type ReactElement } from "react";

interface HandoffSceneProps {
  playerName: string;
  onOpen: () => void;
}

/** Masks every private value while the phone changes hands. */
export function HandoffScene({ playerName, onOpen }: HandoffSceneProps): ReactElement {
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function beginHold(): void {
    timer.current = window.setTimeout(onOpen, 450);
  }

  function cancelHold(): void {
    window.clearTimeout(timer.current);
  }

  return (
    <section className="handoff-panel">
      <p className="section-label">端末を渡してください</p>
      <h1>次は {playerName} さん</h1>
      <p>画面を本人に向けてから、幕を開けてください。</p>
      <button
        className="hold-action"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onOpen();
          }
        }}
        onPointerCancel={cancelHold}
        onPointerDown={beginHold}
        onPointerLeave={cancelHold}
        onPointerUp={cancelHold}
        type="button"
      >
        長押しして手札を開く
      </button>
    </section>
  );
}

