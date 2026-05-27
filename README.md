# ごちそう合戦 - Midnight Buffet

夜の高級ビュッフェを舞台に、数字の予約札でごちそうを奪い合う、スマートフォン向けのオリジナル・パーティーゲームです。最初の公開版は、1台の端末を順番に渡して2〜6人で遊ぶオフライン方式です。

本作は既存商品の公式デジタル版ではありません。タイトル、世界観、アート、文章、UI 表現は独自に制作しています。

## 遊び方

1. `ショート9皿` または `フル15皿` を選び、参加者名を登録します。
2. 料理皿が登場したら、表示された人へ端末を渡します。
3. 本人だけが幕を開き、残っている予約札を1枚選んで封蝋します。
4. 全員が選んだら、クロッシュを開けて一斉公開します。
5. ごちそうは最高の単独札、厄介皿は最低の単独札が獲得します。同じ数字が重なると、その札は判定から外れます。
6. すべての皿を配り終えた時点で、合計得点の高い招待客が勝者です。

## 現在の実装範囲

- 2〜6人の1台パスアンドプレイ
- `ショート9皿` / `フル15皿`
- 端末受け渡し幕、長押しでの秘密手札表示、封蝋、一斉公開
- 同値除外、正負の皿判定、得点表、表彰、再戦
- 音のオン/オフと演出軽減
- 画像生成を基準にした宴会ホール、クロッシュ舞台、料理アート

オンライン版は Vercel と Supabase を用い、合言葉で参加できるルーム、複数端末の秘密選択同期、再接続を追加する実装を進めています。公開中の GitHub Pages 版は従来どおりバックエンドなしの1台遊びで動作します。

## 開発環境

開発実行、依存導入、テスト、ビルドは Docker コンテナ内で行います。

```bash
docker compose build
docker compose up web
```

ブラウザで `http://localhost:5173` を開きます。

### オンライン版のローカル基盤

ブラウザに埋め込む設定は `.env.sample` の `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` のみです。`service_role` key や秘密鍵はクライアント設定へ追加しません。

Supabase CLI は `docker compose build web` で生成したアプリイメージを `supabase-cli` サービスが再利用します。ローカル Supabase は Docker Engine を使用するため、CLI コンテナは Docker socket、host network、migration の参照パスが一致する同一絶対パスを利用します。

```bash
docker compose run --rm supabase-cli start
docker compose run --rm supabase-cli db reset
docker compose run --rm supabase-cli test db
```

### 検証

```bash
docker compose run --rm web npm test
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
docker compose run --rm e2e
docker compose run --rm -e VITE_BASE_PATH=/midnight-buffet/ web npm run build
docker compose run --rm -p 4174:4173 -e VITE_BASE_PATH=/midnight-buffet/ web npm run preview -- --port 4173
```

`test:e2e` は `390x844` と `430x932` のスマートフォン viewport で、ショートゲームの完走、秘密札の非露出、再戦、舞台と手札・CTA の安全余白、横スクロール後の最終札の収まりを実ブラウザ確認します。

最後の2コマンドは GitHub Pages のリポジトリ配下 URL をローカル再現します。preview 起動後は `http://localhost:4174/midnight-buffet/` を開きます。

### 生成画像の最適化

制作ソースは `assets/source/`、配信用 WebP は `public/assets/` に置いています。変換もコンテナ内で実行します。

```bash
docker compose run --rm web npm run optimize:assets
```

## GitHub Pages 公開

`.github/workflows/deploy-pages.yml` は `main` への push 時にテストと Vite build を実行し、`dist/` を GitHub Pages へ配信します。Vite の project site 用 base path は workflow 内でリポジトリ名から設定します。

1. GitHub にリポジトリを作成し、この `main` ブランチを push します。
2. リポジトリの `Settings > Pages > Build and deployment > Source` を `GitHub Actions` に設定します。
3. `Deploy GitHub Pages` workflow の成功後、表示された公開 URL でスマートフォン表示を確認します。

公開後の実配信確認は、Pages URL を指定して同じ実ブラウザ検証を実行します。

```bash
docker compose run --rm -e PLAYWRIGHT_BASE_URL=https://santa928.github.io/midnight-buffet/ e2e
```

## ドキュメント

- 設計仕様: [`docs/specs/2026-05-26-midnight-buffet-design.md`](docs/specs/2026-05-26-midnight-buffet-design.md)
- 実装計画: [`docs/plans/2026-05-26-midnight-buffet-initial-release.md`](docs/plans/2026-05-26-midnight-buffet-initial-release.md)
- オンライン版設計仕様: [`docs/specs/2026-05-27-midnight-buffet-online-design.md`](docs/specs/2026-05-27-midnight-buffet-online-design.md)
- オンライン版実装計画: [`docs/plans/2026-05-27-midnight-buffet-online-release.md`](docs/plans/2026-05-27-midnight-buffet-online-release.md)
- 視覚基準: [`docs/design/midnight-buffet-visual-reference.md`](docs/design/midnight-buffet-visual-reference.md)
