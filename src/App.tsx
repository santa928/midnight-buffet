import type { ReactElement } from "react";

/** Presents the root shell until gameplay scenes are connected. */
export function App(): ReactElement {
  return (
    <main className="app-shell">
      <h1>ごちそう合戦</h1>
      <p>Midnight Buffet</p>
    </main>
  );
}
