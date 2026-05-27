# ごちそう合戦 - Midnight Buffet 初期公開版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 夜の高級ビュッフェを舞台に、スマートフォン1台を回して2〜6人で遊べるリッチな心理戦ゲームを GitHub Pages へ公開可能な品質で制作する。

**Architecture:** React + TypeScript + Vite の静的アプリとして構築し、純粋な `game-domain`、1台回し用の `local-session` / `session-adapter`、シーン別 React UI を分離する。画像生成した宴会ホール・料理・クロッシュを視覚基準とし、可変文言やゲーム情報は DOM で扱う。将来は local adapter を Supabase room adapter に差し替えてオンライン化する。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, CSS, Docker Compose, GitHub Actions / GitHub Pages, Image Gen

**Source Spec:** `docs/specs/2026-05-26-midnight-buffet-design.md`

---

## 0. 実装前の境界とファイル構成

この計画は初期 GitHub Pages 版だけを実装対象とする。Supabase の部屋作成・合言葉参加・同期は実装せず、差し替え境界だけを用意する。

### 作成予定の主要ファイル

| パス | 責務 |
| --- | --- |
| `docs/design/midnight-buffet-visual-reference.md` | 基準 UI 画像の Keep / Adapt / Reject とアセット台帳 |
| `public/assets/backgrounds/banquet-hall.webp` | タイトルとプレイ面共通の夜会背景 |
| `public/assets/stage/cloche-stage.webp` | 中央舞台とクロッシュ |
| `public/assets/dishes/*.webp` | 正負の料理皿アート |
| `public/assets/results/victory-feast.webp` | 最終表彰用アート |
| `Dockerfile`, `compose.yaml` | ホストへ Node 依存を入れずに実行する開発環境 |
| `package.json`, `vite.config.ts`, `tsconfig*.json` | React/Vite/Vitest/Pages のプロジェクト設定 |
| `src/domain/types.ts` | モード、皿、札、プレイヤー、判定結果の型 |
| `src/domain/decks.ts` | 手札と料理皿セット、shuffle の生成 |
| `src/domain/resolveRound.ts` | 同値除外と皿獲得判定 |
| `src/domain/game.ts` | ラウンド進行、得点、順位、再戦開始 |
| `src/session/types.ts` | UI が利用するセッション契約 |
| `src/session/localSession.ts` | 秘密選択を保持する1台回し状態遷移 |
| `src/session/localSessionAdapter.ts` | UI から local session を呼ぶ adapter |
| `src/assets/dishes.ts` | 得点と料理アセット、表示名の対応 |
| `src/audio/useCelebrationAudio.ts` | ユーザー操作後に鳴る効果音の制御 |
| `src/preferences/usePreferences.ts` | 音と演出軽減の設定 |
| `src/components/*` | HUD、料理舞台、札、スコア表、設定トグル |
| `src/scenes/*` | Setup、PassDevice、ChooseCard、Reveal、Results の画面 |
| `src/App.tsx`, `src/styles/*.css` | シーン合成と視覚トークン / レイアウト / 演出 |
| `tests/domain/*.test.ts` | 純粋ルールテスト |
| `tests/session/*.test.ts` | 秘密状態と遷移テスト |
| `tests/ui/*.test.tsx` | 入力・表示・アクセシビリティテスト |
| `e2e/pass-and-play.spec.ts` | 実際の遊びの流れと viewport 検証 |
| `.github/workflows/deploy-pages.yml` | GitHub Pages 配信 |
| `README.md` | 概要、遊び方、Docker 実行、公開手順 |

## 1. 要件とタスク対応表

| 要件 | 実装タスク | 主な証拠 |
| --- | --- | --- |
| REQ-001 独自作品として公開 | Task 1, 9 | 独自生成アセット、README、表示文言確認 |
| REQ-002 1台・2〜6人 | Task 4, 6, 10 | session / UI / E2E テスト |
| REQ-003 秘密選択と一斉公開 | Task 4, 6, 10 | session テスト、E2E の非露出検証 |
| REQ-004 同値除外と正負獲得 | Task 3 | domain テスト |
| REQ-005 9皿 / 15皿・順位・再戦 | Task 2, 3, 7, 10 | domain / UI / E2E テスト |
| REQ-006 生成画像・演出・効果音 | Task 1, 7, 8, 10 | 基準画像、実装スクリーンショット、手動音確認 |
| REQ-007 秘密情報マスク | Task 4, 6, 10 | adapter API、UI / E2E テスト |
| REQ-008 React/Vite/domain/Pages | Task 2, 3, 5, 9 | build、workflow、Pages スモーク |
| REQ-009 session-adapter 境界 | Task 4 | interface と local 実装テスト |
| REQ-010 音/演出軽減/判別/タッチ | Task 8, 10 | UI テスト、viewport 目視・数値確認 |

## Task 0: 承認文書を `main` に記録し、実装作業領域を分離する

**Files:**
- Create: `.gitignore`
- Existing: `docs/specs/2026-05-26-midnight-buffet-design.md`
- Existing: `docs/plans/2026-05-26-midnight-buffet-initial-release.md`

- [ ] **Step 1: 文書用リポジトリを初期化する**

Run locally (製品履歴を開始するだけで、依存導入やサーバ実行は行わない): `git init -b main`

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
.worktrees/
.DS_Store
.env
.env.*
!.env.sample
docs/superpowers/
progress.md
```

Expected: 製品仕様の `docs/specs/` と `docs/plans/` は追跡可能で、作業ログ・依存・分離 worktree は追跡されない。

- [ ] **Step 2: 承認済み文書を `main` の初回コミットにする**

```bash
git add .gitignore docs/specs docs/plans
git commit -m "祝宴ゲームの仕様と実装計画を確定"
```

Expected: `main` は承認文書のみを保持し、画像生成やコード実装はまだ含まない。

- [ ] **Step 3: 実装用 worktree を準備する**

`superpowers:using-git-worktrees` に従い、ユーザーが同意した場合は `.worktrees/midnight-buffet-initial-release` に `feature/midnight-buffet-initial-release` ブランチの worktree を作る。以後の Task 1〜10 はその worktree 内だけで実行する。

```bash
git check-ignore -q .worktrees
git worktree add .worktrees/midnight-buffet-initial-release -b feature/midnight-buffet-initial-release
```

Expected: `main` を直接変更せず、実装コミットを専用ブランチへ積める。

## Task 1: 基準ビジュアルと生成アセットを確定する

**Files:**
- Create: `docs/design/midnight-buffet-visual-reference.md`
- Create: `public/assets/concepts/midnight-buffet-mobile-reference.png`
- Create: `public/assets/backgrounds/banquet-hall.webp`
- Create: `public/assets/stage/cloche-stage.webp`
- Create: `public/assets/dishes/positive-dessert.webp`
- Create: `public/assets/dishes/positive-roast.webp`
- Create: `public/assets/dishes/positive-fruit.webp`
- Create: `public/assets/dishes/negative-burnt.webp`
- Create: `public/assets/dishes/negative-spicy.webp`
- Create: `public/assets/results/victory-feast.webp`

- [ ] **Step 1: Image Gen で基準画面を生成する**

実装用 UI の文字は後で HTML で配置するため、画像内の可変文字に依存しない。次の意図で `390x844 portrait mobile` のゲーム選択画面を生成し、出力を `public/assets/concepts/midnight-buffet-mobile-reference.png` に配置する。

```text
Use case: ui-mockup. Portrait mobile game screen, 390x844.
An original Japanese party game titled "ごちそう合戦 - Midnight Buffet".
Night luxury buffet theatre: deep navy banquet hall, burgundy velvet curtains,
warm candlelight and brass trim. A golden cloche on a spotlighted serving
platform at the center, a jewel-like dessert dish revealed below it.
Slim readable HUD zone at top, large safe area for HTML score labels, lower
zone reserved for five large velvet-and-gold number cards and one CTA button.
Atmosphere: elegant but playful, suitable for coworkers and extended family,
commercially shippable, premium tabletop-game feel.
Avoid: birds, vultures, existing board-game branding, illegible text, cartoon
cheapness, crowded decorations, controls embedded in the raster image.
```

Expected: 中央舞台が主役で、上部 HUD と下部カード操作領域が明確に空いている基準画像が得られる。

- [ ] **Step 2: 背景・舞台・料理・表彰の分離アセットを生成する**

基準画面と同一の照明・素材・視点で、実装可能な分離アセットを生成する。料理は全15点を別画像にせず、正料理3種・厄介皿2種を得点ごとに循環利用し、得点表示は DOM で重ねる。

```text
Asset pass for the approved Midnight Buffet mobile UI:
1) empty vertical banquet hall background, no UI and no text;
2) transparent golden cloche and spotlighted serving platform;
3) transparent plated gem dessert, glazed roast, sparkling fruit parfait;
4) transparent burnt dish with smoke, absurdly spicy dish with red steam;
5) transparent victory banquet arrangement with candles and gold confetti.
All assets share cinematic warm lighting, navy/burgundy/brass palette,
clean silhouettes for mobile compositing, no words, no logos, no existing IP.
```

Expected: 背景1枚、舞台1枚、料理5枚、結果1枚が同一世界観で利用できる。

- [ ] **Step 3: 採否判断と実装トークンを記録する**

`docs/design/midnight-buffet-visual-reference.md` に次を記載する。

```markdown
# Midnight Buffet Visual Reference

## Concept
- Reference: `public/assets/concepts/midnight-buffet-mobile-reference.png`
- Viewport: `390x844`

## Keep
- 紺碧背景とベルベット幕、中央の金クロッシュ、暖かなスポットライト。
- 上部 HUD / 中央料理舞台 / 下部予約札の3層構造。

## Adapt
- 画像内の文字・得点・ボタンは DOM で日本語表示する。
- 料理は5種類の生成アセットを得点値に割り当てて再利用する。

## Reject
- 読みにくい装飾文字や操作を妨げる光粒は実装しない。

## Tokens
- Background: `#081321`
- Surface: `#101c30`
- Velvet: `#541d2d`
- Gold: `#d7b56d`
- Text: `#fbf2db`
- Positive: `#f4cd72`
- Negative: `#ef7164`
- Radius: `18px`, `28px`

## Checks
- `390x844` と `430x932` で料理・札・CTA が重ならない。
- 背景と料理は WebP 化後も顔料感と光沢が破綻しない。
```

Expected: 実装時に勝手な配色・レイアウト変更を行わない参照資料が残る。

- [ ] **Step 4: アセット容量を確認する**

Run locally (ファイル確認のみ): `du -ch public/assets/**/*.webp | tail -n 1`

Expected: 初回表示に使う主要 WebP の合計が `3M` 以下。超える場合は画像寸法または品質を調整してから次へ進む。

- [ ] **Step 5: 生成物をコミットする**

```bash
git add docs/design public/assets
git commit -m "基準ビジュアルと祝宴アセットを追加"
```

Expected: 独自世界観の基準と配信用アセットが1コミットで確認できる。

## Task 2: Docker ベースの React/Vite プロジェクトを作成する

**Files:**
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/main.tsx`
- Create: `src/vite-env.d.ts`
- Create: `src/App.tsx`
- Create: `src/styles/globals.css`

- [ ] **Step 1: Node 実行を Docker に閉じる設定を作成する**

Create `Dockerfile`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

Create `compose.yaml`:

```yaml
services:
  web:
    build: .
    working_dir: /app
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    ports:
      - "5173:5173"
    environment:
      - CHOKIDAR_USEPOLLING=true

volumes:
  node_modules:
```

Expected: `npm` や Vite は常にコンテナ内で動く。

- [ ] **Step 2: package と TypeScript/Vite 設定を追加する**

Create `package.json`:

```json
{
  "name": "midnight-buffet",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^22.15.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.4.0",
    "jsdom": "^26.1.0",
    "typescript": "~5.8.3",
    "vite": "^6.1.0",
    "vitest": "^3.1.0"
  }
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/midnight-buffet/" : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create TypeScript project references using Vite's strict React template configuration, with `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` enabled.

Expected: `vite build` は Pages 配下アセット URL を生成し、テストは jsdom で実行できる。

- [ ] **Step 3: 最小 app shell を作成して依存を導入する**

Create `src/App.tsx`:

```tsx
/** Presents the root shell until gameplay scenes are connected. */
export function App(): JSX.Element {
  return <main className="app-shell">ごちそう合戦 - Midnight Buffet</main>;
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Run in Docker (ネットワークを使って依存を取得し lockfile を生成): `docker compose run --rm web npm install`

Run in Docker: `docker compose run --rm web npm run build`

Expected: `package-lock.json` と `dist/index.html` が生成され、build が成功する。

- [ ] **Step 4: 土台をコミットする**

```bash
git add .gitignore Dockerfile compose.yaml package.json package-lock.json index.html tsconfig*.json vite.config.ts vitest.setup.ts src docs/specs docs/plans
git commit -m "祝宴ゲームの開発基盤を構築"
```

Expected: 承認仕様と実行可能な静的アプリ土台が追跡される。

## Task 3: 純粋なゲームルールをテスト駆動で実装する

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/decks.ts`
- Create: `src/domain/resolveRound.ts`
- Create: `src/domain/game.ts`
- Create: `tests/domain/decks.test.ts`
- Create: `tests/domain/resolveRound.test.ts`
- Create: `tests/domain/game.test.ts`

- [ ] **Step 1: デッキ定義の失敗テストを書く**

Create `tests/domain/decks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createBidCards, createDishDeck } from "../../src/domain/decks";

describe("deck creation", () => {
  it("creates bid cards from 1 through 15", () => {
    expect(createBidCards()).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("creates nine short-mode dishes with six positive and three negative values", () => {
    const deck = createDishDeck("short", (values) => values);
    expect(deck.map((dish) => dish.points)).toEqual([1, 2, 3, 4, 5, 6, -1, -2, -3]);
  });

  it("creates fifteen full-mode dishes with ten positive and five negative values", () => {
    const deck = createDishDeck("full", (values) => values);
    expect(deck.map((dish) => dish.points)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1, -2, -3, -4, -5,
    ]);
  });
});
```

Run in Docker: `docker compose run --rm web npm test -- tests/domain/decks.test.ts`

Expected: FAIL because `src/domain/decks.ts` does not exist.

- [ ] **Step 2: ドメイン型とデッキ生成を実装する**

Create `src/domain/types.ts`:

```ts
export type GameMode = "short" | "full";
export type PlayerId = string;
export type BidValue = number;

export interface Dish {
  id: string;
  points: number;
  kind: "positive" | "negative";
}

export interface Selection {
  playerId: PlayerId;
  bid: BidValue;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  remainingBids: BidValue[];
  capturedDishes: Dish[];
  score: number;
}
```

Create `src/domain/decks.ts`:

```ts
import type { BidValue, Dish, GameMode } from "./types";

type Shuffler<T> = (values: T[]) => T[];

/** Creates the common set of one-use numbered reservation cards. */
export function createBidCards(): BidValue[] {
  return Array.from({ length: 15 }, (_, index) => index + 1);
}

/** Creates and shuffles the dish deck for the selected match length. */
export function createDishDeck(
  mode: GameMode,
  shuffle: Shuffler<Dish> = shuffleValues,
): Dish[] {
  const positiveLimit = mode === "short" ? 6 : 10;
  const negativeLimit = mode === "short" ? 3 : 5;
  const points = [
    ...Array.from({ length: positiveLimit }, (_, i) => i + 1),
    ...Array.from({ length: negativeLimit }, (_, i) => -(i + 1)),
  ];
  return shuffle(
    points.map((value) => ({
      id: `dish-${value > 0 ? "plus" : "minus"}-${Math.abs(value)}`,
      points: value,
      kind: value > 0 ? "positive" : "negative",
    })),
  );
}

function shuffleValues<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
```

Run in Docker: `docker compose run --rm web npm test -- tests/domain/decks.test.ts`

Expected: PASS.

- [ ] **Step 3: 判定の失敗テストを書く**

Create `tests/domain/resolveRound.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveRound } from "../../src/domain/resolveRound";

describe("resolveRound", () => {
  it("awards a positive dish to the highest unique bid", () => {
    const result = resolveRound(
      { id: "dessert", points: 7, kind: "positive" },
      [{ playerId: "a", bid: 12 }, { playerId: "b", bid: 9 }],
    );
    expect(result.winnerId).toBe("a");
  });

  it("awards a negative dish to the lowest unique bid", () => {
    const result = resolveRound(
      { id: "burnt", points: -4, kind: "negative" },
      [{ playerId: "a", bid: 12 }, { playerId: "b", bid: 3 }],
    );
    expect(result.winnerId).toBe("b");
  });

  it("removes collisions and lets the next valid bid win", () => {
    const result = resolveRound(
      { id: "dessert", points: 5, kind: "positive" },
      [
        { playerId: "a", bid: 15 },
        { playerId: "b", bid: 15 },
        { playerId: "c", bid: 8 },
      ],
    );
    expect(result.collidedBids).toEqual([15]);
    expect(result.winnerId).toBe("c");
  });

  it("leaves a dish unserved when all bids collide", () => {
    const result = resolveRound(
      { id: "dessert", points: 5, kind: "positive" },
      [{ playerId: "a", bid: 8 }, { playerId: "b", bid: 8 }],
    );
    expect(result.winnerId).toBeNull();
    expect(result.status).toBe("unserved");
  });
});
```

Run in Docker: `docker compose run --rm web npm test -- tests/domain/resolveRound.test.ts`

Expected: FAIL because `resolveRound` does not exist.

- [ ] **Step 4: 同値除外と獲得者判定を実装する**

Create `src/domain/resolveRound.ts`:

```ts
import type { BidValue, Dish, PlayerId, Selection } from "./types";

export interface RoundResolution {
  dish: Dish;
  selections: Selection[];
  collidedBids: BidValue[];
  eligibleSelections: Selection[];
  winnerId: PlayerId | null;
  status: "awarded" | "unserved";
}

/** Resolves a revealed round after removing every repeated bid value. */
export function resolveRound(dish: Dish, selections: Selection[]): RoundResolution {
  const counts = new Map<BidValue, number>();
  selections.forEach(({ bid }) => counts.set(bid, (counts.get(bid) ?? 0) + 1));
  const collidedBids = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([bid]) => bid)
    .sort((a, b) => a - b);
  const eligibleSelections = selections.filter(({ bid }) => !collidedBids.includes(bid));

  if (eligibleSelections.length === 0) {
    return { dish, selections, collidedBids, eligibleSelections, winnerId: null, status: "unserved" };
  }
  const winner = eligibleSelections.reduce((current, candidate) => {
    const candidateWins =
      dish.kind === "positive" ? candidate.bid > current.bid : candidate.bid < current.bid;
    return candidateWins ? candidate : current;
  });
  return { dish, selections, collidedBids, eligibleSelections, winnerId: winner.playerId, status: "awarded" };
}
```

Run in Docker: `docker compose run --rm web npm test -- tests/domain/resolveRound.test.ts`

Expected: PASS.

- [ ] **Step 5: 進行・順位・再戦の失敗テストを書く**

Create `tests/domain/game.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  applyRoundResolution,
  beginNextRound,
  rankPlayers,
  restartGame,
  startGame,
} from "../../src/domain/game";
import { resolveRound } from "../../src/domain/resolveRound";

describe("game lifecycle", () => {
  it("starts short mode with nine dishes and full hands", () => {
    const state = startGame(["杏", "蓮"], "short", (values) => values);
    expect(state.remainingDishes).toHaveLength(9);
    expect(state.players.every((player) => player.remainingBids.length === 15)).toBe(true);
  });

  it("consumes selected bids and gives points only to the winning player", () => {
    const started = startGame(["杏", "蓮"], "short", (values) => values);
    const round = beginNextRound(started);
    const dish = round.currentDish!;
    const resolution = resolveRound(dish, [
      { playerId: round.players[0].id, bid: 14 },
      { playerId: round.players[1].id, bid: 4 },
    ]);
    const updated = applyRoundResolution(round, resolution);
    const winner = updated.players.find((player) => player.id === resolution.winnerId)!;
    expect(winner.score).toBe(dish.points);
    expect(updated.players[0].remainingBids).not.toContain(14);
    expect(updated.players[1].remainingBids).not.toContain(4);
  });

  it("shares a rank when final scores tie", () => {
    const state = startGame(["杏", "蓮"], "short", (values) => values);
    expect(rankPlayers(state.players).map(({ rank }) => rank)).toEqual([1, 1]);
  });

  it("restarts with the same guests and mode but clean scores and hands", () => {
    const started = startGame(["杏", "蓮"], "short", (values) => values);
    const restarted = restartGame(started, (values) => values);
    expect(restarted.mode).toBe("short");
    expect(restarted.players.map(({ name }) => name)).toEqual(["杏", "蓮"]);
    expect(restarted.players.every(({ score }) => score === 0)).toBe(true);
    expect(restarted.players.every(({ remainingBids }) => remainingBids.length === 15)).toBe(true);
  });
});
```

Run in Docker: `docker compose run --rm web npm test -- tests/domain/game.test.ts`

Expected: FAIL because `game.ts` does not exist.

- [ ] **Step 6: 進行 API を実装し全 domain テストを通す**

Create `src/domain/game.ts` defining:

```ts
export interface GameState {
  mode: GameMode;
  players: PlayerState[];
  remainingDishes: Dish[];
  completedDishes: Dish[];
  currentDish: Dish | null;
  lastResolution: RoundResolution | null;
  isComplete: boolean;
}

export function startGame(names: string[], mode: GameMode, shuffle?: (values: Dish[]) => Dish[]): GameState;
export function beginNextRound(state: GameState): GameState;
export function applyRoundResolution(state: GameState, resolution: RoundResolution): GameState;
export function rankPlayers(players: PlayerState[]): Array<PlayerState & { rank: number }>;
export function restartGame(state: GameState, shuffle?: (values: Dish[]) => Dish[]): GameState;
```

Implementation requirements:

```ts
// startGame trims and validates two to six unique non-empty names, then builds fresh hands and deck.
// beginNextRound pulls the next dish without mutating prior state.
// applyRoundResolution removes each used bid, appends the dish only to a winner,
// updates scores, and marks completion when no remaining or current dish remains.
// rankPlayers applies competition ranking with tied equal scores sharing a rank.
// restartGame invokes startGame with prior names, mode, and injectable shuffler.
```

Run in Docker: `docker compose run --rm web npm test -- tests/domain`

Expected: PASS for deck, resolution, lifecycle, score, ranking, and restart cases.

- [ ] **Step 7: domain をコミットする**

```bash
git add src/domain tests/domain
git commit -m "祝宴のゲーム判定ロジックを実装"
```

## Task 4: 秘密を保持する local session adapter を実装する

**Files:**
- Create: `src/session/types.ts`
- Create: `src/session/localSession.ts`
- Create: `src/session/localSessionAdapter.ts`
- Create: `tests/session/localSession.test.ts`

- [ ] **Step 1: 秘密表示境界の失敗テストを書く**

Create `tests/session/localSession.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLocalSession } from "../../src/session/localSession";

describe("local pass-and-play session", () => {
  it("shows no hand or hidden choice on the pass-device public snapshot", () => {
    const session = createLocalSession(["杏", "蓮"], "short");
    expect(session.getPublicSnapshot().scene).toBe("pass-device");
    expect(session.getPublicSnapshot()).not.toHaveProperty("hand");
    expect(session.getPublicSnapshot()).not.toHaveProperty("selections");
  });

  it("reveals only the current player's hand after explicit unlock", () => {
    const session = createLocalSession(["杏", "蓮"], "short");
    session.unlockForCurrentPlayer();
    const privateView = session.getPrivateSnapshot();
    expect(privateView.playerName).toBe("杏");
    expect(privateView.hand).toHaveLength(15);
  });

  it("masks a sealed selection before passing to the next player", () => {
    const session = createLocalSession(["杏", "蓮"], "short");
    session.unlockForCurrentPlayer();
    session.sealBid(14);
    expect(session.getPublicSnapshot().scene).toBe("pass-device");
    expect(JSON.stringify(session.getPublicSnapshot())).not.toContain("14");
  });

  it("moves to reveal only after every player has sealed a bid", () => {
    const session = createLocalSession(["杏", "蓮"], "short");
    session.unlockForCurrentPlayer();
    session.sealBid(14);
    session.unlockForCurrentPlayer();
    session.sealBid(8);
    expect(session.getPublicSnapshot().scene).toBe("reveal-ready");
  });
});
```

Run in Docker: `docker compose run --rm web npm test -- tests/session/localSession.test.ts`

Expected: FAIL because local session has not been implemented.

- [ ] **Step 2: UI が秘密値を誤読しない契約を定義する**

Create `src/session/types.ts`:

```ts
import type { BidValue, Dish, GameMode, PlayerState } from "../domain/types";
import type { RoundResolution } from "../domain/resolveRound";

export type Scene = "setup" | "pass-device" | "choose-card" | "reveal-ready" | "revealed" | "results";

export interface PublicSnapshot {
  scene: Scene;
  mode: GameMode;
  roundNumber: number;
  roundCount: number;
  currentDish: Dish | null;
  nextPlayerName?: string;
  scoreboard: Array<Pick<PlayerState, "id" | "name" | "score" | "capturedDishes">>;
  resolution: RoundResolution | null;
}

export interface PrivateSnapshot extends PublicSnapshot {
  scene: "choose-card";
  playerName: string;
  hand: BidValue[];
}

export interface SessionAdapter {
  getPublicSnapshot(): PublicSnapshot;
  unlockForCurrentPlayer(): void;
  getPrivateSnapshot(): PrivateSnapshot;
  sealBid(bid: BidValue): void;
  revealRound(): void;
  continueAfterReveal(): void;
  restart(): void;
}
```

Expected: public snapshot の型に `hand` や非公開 `selections` がない。

- [ ] **Step 3: local state machine と adapter を実装する**

Create `src/session/localSession.ts` as a small state machine around `startGame`, `beginNextRound`, and `resolveRound`. It stores `pendingSelections` only in the closure, returns no pending bids from `getPublicSnapshot()`, changes phase in this order:

```text
pass-device -> choose-card -> pass-device ... -> reveal-ready
reveal-ready -> revealed -> pass-device | results
results -> pass-device (restart)
```

Create `src/session/localSessionAdapter.ts`:

```ts
import type { GameMode } from "../domain/types";
import type { SessionAdapter } from "./types";
import { createLocalSession } from "./localSession";

/** Creates the current offline session behind the future online adapter seam. */
export function createLocalSessionAdapter(names: string[], mode: GameMode): SessionAdapter {
  return createLocalSession(names, mode);
}
```

Run in Docker: `docker compose run --rm web npm test -- tests/session/localSession.test.ts`

Expected: PASS, and public serialization never contains chosen bids before reveal.

- [ ] **Step 4: adapter 境界をコミットする**

```bash
git add src/session tests/session
git commit -m "一台回しの秘密セッション境界を実装"
```

## Task 5: 設定画面とアプリシェルを実装する

**Files:**
- Create: `src/assets/dishes.ts`
- Create: `src/components/SettingsToolbar.tsx`
- Create: `src/components/BanquetStage.tsx`
- Create: `src/scenes/SetupScene.tsx`
- Modify: `src/App.tsx`
- Create: `tests/ui/SetupScene.test.tsx`
- Modify: `src/styles/globals.css`
- Create: `src/styles/tokens.css`
- Create: `src/styles/scenes.css`

- [ ] **Step 1: 設定フローの失敗 UI テストを書く**

Create `tests/ui/SetupScene.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SetupScene } from "../../src/scenes/SetupScene";

describe("SetupScene", () => {
  it("requires two non-duplicate names before starting the banquet", () => {
    const onStart = vi.fn();
    render(<SetupScene onStart={onStart} />);
    fireEvent.change(screen.getByLabelText("招待客 1 の名前"), { target: { value: "杏" } });
    fireEvent.change(screen.getByLabelText("招待客 2 の名前"), { target: { value: "杏" } });
    fireEvent.click(screen.getByRole("button", { name: "祝宴を始める" }));
    expect(screen.getByText("同じ名前は使えません")).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("starts the selected mode with two through six entered players", () => {
    const onStart = vi.fn();
    render(<SetupScene onStart={onStart} />);
    fireEvent.click(screen.getByRole("radio", { name: "ショート9皿" }));
    fireEvent.change(screen.getByLabelText("招待客 1 の名前"), { target: { value: "杏" } });
    fireEvent.change(screen.getByLabelText("招待客 2 の名前"), { target: { value: "蓮" } });
    fireEvent.click(screen.getByRole("button", { name: "祝宴を始める" }));
    expect(onStart).toHaveBeenCalledWith(["杏", "蓮"], "short");
  });
});
```

Run in Docker: `docker compose run --rm web npm test -- tests/ui/SetupScene.test.tsx`

Expected: FAIL because setup scene does not exist.

- [ ] **Step 2: 料理表示台帳と setup components を実装する**

Create `src/assets/dishes.ts` mapping each positive/negative dish to generated asset URLs through `import.meta.env.BASE_URL`, Japanese dish labels, and alt text. Reuse three positive and two negative artworks across the score values without embedding score text in images.

Create `src/scenes/SetupScene.tsx` with:

```ts
interface SetupSceneProps {
  onStart: (names: string[], mode: GameMode) => void;
}
```

Behavior:

```text
- Default mode is "short".
- Start with two name fields; + button adds up to six and delete removes down to two.
- Trim values; show "名前を入力してください" and "同じ名前は使えません" inline.
- CTA label is "祝宴を始める".
```

Create `BanquetStage` to display generated background/stage assets and leave a semantic content layer for DOM text. Create `SettingsToolbar` placeholder accepting sound/reduced-motion states for connection in Task 8.

Run in Docker: `docker compose run --rm web npm test -- tests/ui/SetupScene.test.tsx`

Expected: PASS.

- [ ] **Step 3: App を setup から session 生成へ接続する**

Modify `src/App.tsx` to keep `SessionAdapter | null` state. Before start, render `SetupScene`; on start create `createLocalSessionAdapter(names, mode)` and render the current public scene host.

Add CSS token definitions from `docs/design/midnight-buffet-visual-reference.md`; apply the background, center stage, gold controls, focus rings, and mobile-safe insets.

Run in Docker: `docker compose run --rm web npm test`

Expected: all domain, session, and setup tests PASS.

- [ ] **Step 4: setup shell をコミットする**

```bash
git add src tests/ui
git commit -m "祝宴の開始画面と舞台シェルを実装"
```

## Task 6: 受け渡しと秘密選択の画面を実装する

**Files:**
- Create: `src/components/BidCard.tsx`
- Create: `src/components/ScoreRail.tsx`
- Create: `src/scenes/PassDeviceScene.tsx`
- Create: `src/scenes/ChooseCardScene.tsx`
- Modify: `src/App.tsx`
- Create: `tests/ui/SecretSelection.test.tsx`
- Modify: `src/styles/scenes.css`

- [ ] **Step 1: 秘密情報を表示しない UI テストを書く**

Create `tests/ui/SecretSelection.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";

function startTwoPlayerShortGame(): void {
  fireEvent.change(screen.getByLabelText("招待客 1 の名前"), { target: { value: "杏" } });
  fireEvent.change(screen.getByLabelText("招待客 2 の名前"), { target: { value: "蓮" } });
  fireEvent.click(screen.getByRole("button", { name: "祝宴を始める" }));
}

describe("secret selection flow", () => {
  it("keeps hands hidden on the pass-device scene", () => {
    render(<App />);
    startTwoPlayerShortGame();
    expect(screen.getByText("端末を杏さんへ渡してください")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /予約札 15/ })).not.toBeInTheDocument();
  });

  it("masks a sealed bid while the next player receives the device", () => {
    vi.useFakeTimers();
    render(<App />);
    startTwoPlayerShortGame();
    const unlock = screen.getByRole("button", { name: "本人が長押しして開く" });
    fireEvent.pointerDown(unlock);
    act(() => vi.advanceTimersByTime(700));
    fireEvent.pointerUp(unlock);
    fireEvent.click(screen.getByRole("button", { name: "予約札 15" }));
    fireEvent.click(screen.getByRole("button", { name: "この札を封蝋する" }));
    expect(screen.getByText("端末を蓮さんへ渡してください")).toBeInTheDocument();
    expect(screen.queryByText("15")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
```

Run in Docker: `docker compose run --rm web npm test -- tests/ui/SecretSelection.test.tsx`

Expected: FAIL because pass and choose scenes are missing.

- [ ] **Step 2: PassDeviceScene を実装する**

Implement a full-height velvet curtain scene with only current dish's public identity, recipient name, and a hold-to-open button. Use pointer down/up duration tracking; unlock only after at least `700ms`. Provide keyboard-accessible alternative by allowing Enter/Space press with the same progress indicator and visible instruction.

Key component contract:

```ts
interface PassDeviceSceneProps {
  nextPlayerName: string;
  dish: Dish;
  onUnlock: () => void;
}
```

Expected: pass screen contains no hand or bid values.

- [ ] **Step 3: ChooseCardScene とカード操作を実装する**

Create `BidCard` as a real button, with selected and disabled-used variants. Create `ChooseCardScene` with current dish, private hand, selected card local state, and `この札を封蝋する` confirmation. It passes only a confirmed bid to `adapter.sealBid()` and immediately renders the next public snapshot.

Run in Docker: `docker compose run --rm web npm test -- tests/ui/SecretSelection.test.tsx`

Expected: PASS for mask and hand visibility behavior.

- [ ] **Step 4: 選択画面をコミットする**

```bash
git add src tests/ui
git commit -m "端末受け渡しと秘密の予約札選択を実装"
```

## Task 7: 一斉公開ショー、得点、結果、再戦を実装する

**Files:**
- Create: `src/components/RevealedBid.tsx`
- Create: `src/components/DishCard.tsx`
- Create: `src/scenes/RevealScene.tsx`
- Create: `src/scenes/ResultsScene.tsx`
- Modify: `src/App.tsx`
- Create: `tests/ui/RevealAndResults.test.tsx`
- Modify: `src/styles/scenes.css`

- [ ] **Step 1: 公開と結果の失敗テストを書く**

Create `tests/ui/RevealAndResults.test.tsx` with a helper that enters two players and seals deterministic bids. Assert:

```tsx
expect(screen.getByRole("button", { name: "クロッシュを開ける" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "クロッシュを開ける" }));
expect(screen.getByText(/バッティング/)).toBeInTheDocument(); // when equal bids are sealed
expect(screen.getByText(/未配膳/)).toBeInTheDocument(); // when all collide
expect(screen.getByRole("button", { name: "次の皿へ" })).toBeInTheDocument();
```

For a controlled full completion, inject or mock a nine-round session and assert `もう一度乾杯` restores a fresh round with the same names and no prior score.

Run in Docker: `docker compose run --rm web npm test -- tests/ui/RevealAndResults.test.tsx`

Expected: FAIL because reveal and result screens are missing.

- [ ] **Step 2: RevealScene を実装する**

Before opening, show the plated dish under the cloche and one `クロッシュを開ける` CTA. Once clicked, call `adapter.revealRound()` exactly once, reveal all submitted cards, apply `collision` styling to duplicate cards, and present either:

```text
"{name} さんが {dishLabel} を獲得！ +{points} 点"
"{name} さんが厄介皿を引き取り… {points} 点"
"全員バッティング！ この皿は未配膳"
```

Only after this presentation is visible enable `次の皿へ`, which calls `adapter.continueAfterReveal()`.

- [ ] **Step 3: ResultsScene と再戦を実装する**

Use `rankPlayers()` output, `victory-feast.webp`, and captured dish miniatures. For shared first rank, show `共同優勝！`; otherwise show `今夜の主役は {name} さん！`. Provide `もう一度乾杯` calling `adapter.restart()` and `設定へ戻る` clearing the adapter.

Run in Docker: `docker compose run --rm web npm test -- tests/ui/RevealAndResults.test.tsx`

Expected: PASS.

- [ ] **Step 4: 公開演出と結果をコミットする**

```bash
git add src tests/ui
git commit -m "一斉公開ショーと表彰結果を実装"
```

## Task 8: 効果音、演出軽減、アクセシビリティを完成させる

**Files:**
- Create: `src/preferences/usePreferences.ts`
- Create: `src/audio/useCelebrationAudio.ts`
- Modify: `src/components/SettingsToolbar.tsx`
- Modify: `src/scenes/RevealScene.tsx`
- Modify: `src/styles/globals.css`
- Modify: `src/styles/scenes.css`
- Create: `tests/ui/Preferences.test.tsx`

- [ ] **Step 1: 設定の失敗テストを書く**

Create `tests/ui/Preferences.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App";

describe("presentation preferences", () => {
  it("lets players mute audio and reduce motion", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "音をオフにする" }));
    expect(screen.getByRole("button", { name: "音をオンにする" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "演出を軽減する" }));
    expect(document.documentElement).toHaveAttribute("data-reduced-motion", "true");
  });
});
```

Run in Docker: `docker compose run --rm web npm test -- tests/ui/Preferences.test.tsx`

Expected: FAIL until preferences are connected.

- [ ] **Step 2: 設定 hook とツールバーを実装する**

`usePreferences()` stores `soundEnabled` and `reducedMotion` in React state and initializes reduced motion from `window.matchMedia("(prefers-reduced-motion: reduce)")`. `SettingsToolbar` exposes pressed state and clear accessible labels. Set `document.documentElement.dataset.reducedMotion` so CSS transitions can collapse durations.

Run in Docker: `docker compose run --rm web npm test -- tests/ui/Preferences.test.tsx`

Expected: PASS.

- [ ] **Step 3: 軽量な効果音をユーザー操作後だけ鳴らす**

Create `useCelebrationAudio.ts` using `AudioContext` only after a button action. Implement named cues:

```ts
type Cue = "bell" | "seal" | "reveal" | "collision" | "win" | "negative";
interface CelebrationAudio {
  play(cue: Cue): void;
}
```

Use short oscillator/envelope combinations rather than loading large audio files: warm bell on unlock, soft wax stamp on sealing, brass shimmer on reveal, muted impact on collision, major arpeggio on good dish, descending sting on negative dish. Do nothing when sound is disabled or audio context cannot start.

Connect cues to PassDevice, ChooseCard, and Reveal controls. This supplies original effects without external licensed recordings and keeps the asset budget for visual quality.

- [ ] **Step 4: 操作・動き・判読性を監査する**

Ensure:

```css
.tap-target { min-height: 48px; min-width: 48px; }
[data-reduced-motion="true"] *, @media (prefers-reduced-motion: reduce) { animation-duration: 1ms; transition-duration: 1ms; }
```

Every points display includes a visible `+` or `-` sign and screen-reader label. Every button has focus styling. Do not remove score labels when an image fails to load.

Run in Docker: `docker compose run --rm web npm test`

Expected: all UI and domain tests PASS.

- [ ] **Step 5: 設定とアクセシビリティをコミットする**

```bash
git add src tests/ui
git commit -m "祝宴演出と操作支援設定を仕上げ"
```

## Task 9: GitHub Pages 配信とドキュメントを整える

**Files:**
- Modify: `vite.config.ts`
- Create: `.github/workflows/deploy-pages.yml`
- Create: `README.md`
- Create: `.env.sample`
- Create: `public/404.html` only if actual client-side paths are introduced; otherwise do not add it

- [ ] **Step 1: Pages base をリポジトリ名から設定できるようにする**

Modify `vite.config.ts` to use `VITE_BASE_PATH`:

```ts
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: "./vitest.setup.ts" },
});
```

Create `.env.sample`:

```dotenv
# GitHub Pages project site example: /midnight-buffet/
VITE_BASE_PATH=/
```

Expected: GitHub リポジトリ名の確定前に不正な固定パスを公開しない。

- [ ] **Step 2: deploy workflow を追加する**

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

Expected: `main` への push 後、Pages artifact と配信 URL が生成される。

- [ ] **Step 3: README に遊び方と実行方法を書く**

Create `README.md` including:

```markdown
# ごちそう合戦 - Midnight Buffet

スマートフォン1台を渡しながら、秘密の予約札で料理を奪い合う
2〜6人用のオリジナル・パーティーゲームです。

## 遊び方
1. ショート9皿またはフル15皿を選び、招待客名を入力します。
2. 端末を表示された人へ渡し、本人だけが予約札を選びます。
3. 全員が封蝋したらクロッシュを開け、一斉公開します。
4. 同じ数字はバッティング。良い皿は最高の単独札、厄介皿は最低の単独札が引き取ります。

## 開発
開発実行と依存導入は Docker コンテナ内で行います。

```sh
docker compose build
docker compose run --rm web npm install
docker compose up web
docker compose run --rm web npm test
docker compose run --rm web npm run build
```

## 公開
GitHub Pages workflow は `main` push 時に静的アプリを配信します。
```

Also document that title/art/text are original and online room play is a later Vercel + Supabase phase.

- [ ] **Step 4: Pages 用ビルドを検証する**

Run in Docker: `docker compose run --rm -e VITE_BASE_PATH=/midnight-buffet/ web npm run build`

Run locally (生成物確認のみ): `rg -n '/midnight-buffet/' dist/index.html`

Expected: build passes and generated asset references contain `/midnight-buffet/`.

- [ ] **Step 5: 配信準備をコミットする**

```bash
git add .github README.md .env.sample vite.config.ts
git commit -m "GitHub Pages 公開設定と遊び方を追加"
```

## Task 10: ブラウザ QA、レイアウト数値確認、公開を完了する

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/pass-and-play.spec.ts`
- Create: `docs/qa/initial-release-verification.md`
- Modify: UI/CSS/assets only when comparison exposes a concrete mismatch

- [ ] **Step 1: Playwright E2E の基本フローを書く**

Create `playwright.config.ts` configured for the container preview URL and two portrait projects:

```ts
projects: [
  { name: "iphone-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: "iphone-430", use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true } },
]
```

Create `e2e/pass-and-play.spec.ts` to:

```text
1. start a two-player short game;
2. confirm no reservation-card buttons appear on pass-device screen;
3. hold to unlock, select and seal cards for both players;
4. reveal and assert an award or unserved result appears;
5. capture screenshots for setup, choose-card, reveal, and results states;
6. complete all nine rounds and verify result + retry controls.
```

Expected: E2E covers the full usable path and secret masking.

- [ ] **Step 2: Docker 内で検証サーバと E2E を動かす**

Run in Docker: `docker compose run --rm web npm test`

Run in Docker: `docker compose run --rm web npm run build`

Run in Docker using an E2E-capable Playwright service or image configured during execution: `npm run test:e2e`

Expected: unit/UI tests, type/build, and both portrait E2E projects PASS. If browser binaries are added, add them through a Docker-only service/image; do not install them on the host.

- [ ] **Step 3: Browser/IAB で可視 UI を確認する**

Start preview in Docker: `docker compose up web`

Use the Browser plugin to open the known local target, navigate through setup, secret choice, reveal, and results. Before judging static UI changes, use a cache-busting URL such as `/?qa=initial-release-1`.

Expected: controls work on the rendered product, images load, and stale cache does not conceal the current assets.

- [ ] **Step 4: viewport と親境界の数値を検証する**

In Playwright, for `390x844` and `430x932`, evaluate bounding boxes for:

```text
stage.bottom + safeGap <= cards.top
cards.bottom <= viewport.height - safeInset
cta.bottom <= viewport.height - safeInset
scoreRail.right <= viewport.width - safeInset
```

Use `safeGap >= 12` and `safeInset >= 8` CSS px as pass criteria. Record measured values in `docs/qa/initial-release-verification.md`.

Expected: 舞台・札・CTA・得点表が重ならず親画面内に収まる。

- [ ] **Step 5: 基準画像と実装スクリーンショットを目視比較する**

Open with image viewing:

```text
public/assets/concepts/midnight-buffet-mobile-reference.png
test-results/screenshots/iphone-390-reveal.png
test-results/screenshots/iphone-430-results.png
```

Record at least five comparison points:

```markdown
| Point | Concept evidence | Render evidence | Status / Fix |
| --- | --- | --- | --- |
| Palette | navy / velvet / gold | ... | ... |
| Center stage | cloche anchors meal | ... | ... |
| Card touch zone | separated lower rail | ... | ... |
| Copy hierarchy | DOM-native labels readable | ... | ... |
| Reveal mood | spotlight/collision/result | ... | ... |
```

Expected: 修正可能な目立つ劣化を残さず、比較画像自体を目視した事実が記録される。

- [ ] **Step 6: GitHub リポジトリへ接続し Pages を公開する**

This step requires the target GitHub repository name/owner or permission to create one. Once supplied, use `gh` to create or connect the repository, push `main`, enable Pages via GitHub Actions, and inspect workflow result and deployed URL.

Expected: 実際の GitHub Pages URL で `ショート9皿` の開始から公開画面までスモーク確認できる。

- [ ] **Step 7: 初期公開確認をコミットする**

```bash
git add playwright.config.ts e2e docs/qa
git commit -m "初期公開版の実機相当検証を追加"
```

Expected: QA 証跡と公開確認内容が履歴に残る。

## 実装完了判定

初期 GitHub Pages 版については、以下をすべて満たすまで完了としない。

- [ ] `docs/specs/2026-05-26-midnight-buffet-design.md` の `REQ-001` から `REQ-010` に対し、上記対応表の証拠が存在する。
- [ ] Docker 内で `npm test` と `npm run build` が成功する。
- [ ] 2つの縦 viewport でパスアンドプレイ E2E と境界数値検証が成功する。
- [ ] 基準画像と最新スクリーンショットを実際に目視比較し、目立つ不一致を修正または意図的差分として記録する。
- [ ] GitHub Pages 上の実 URL で主要フローを確認する。
- [ ] 将来オンライン版は未完了であるため、Supabase 版の実装と検証が完了するまでスレッド全体の最終目標は完了扱いにしない。
