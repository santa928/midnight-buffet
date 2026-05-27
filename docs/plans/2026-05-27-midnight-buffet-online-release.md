# オンライン祝宴版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vercel + Supabase を用い、招待コードと合言葉で複数端末から参加し、幹事進行で秘密札を同期できるオンライン祝宴を追加する。

**Architecture:** 公開済みの一台回しモードは維持し、オンライン選択時だけ Supabase client とオンライン画面を lazy load する。Supabase Anonymous Auth で端末を識別し、RLS と Security Definer RPC により合言葉照合、封蝋、公開、再戦を DB transaction 内で実行する。Realtime 通知は状態変化の合図に限定し、安全な snapshot RPC を再取得して画面を更新する。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, Supabase JS v2, Supabase CLI + Postgres/pgTAP, Docker Compose, Vercel

**Requirements:** `docs/specs/2026-05-27-midnight-buffet-online-design.md` の `REQ-011` から `REQ-019` を実装対象とし、`REQ-001` から `REQ-010` の既存挙動を退行させない。

---

## File Map

| File | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json` | Supabase JS / CLI と DB 検証 command を定義する。 |
| `.env.sample` | ブラウザ公開可能な Supabase 設定だけを例示する。 |
| `compose.yaml` | Supabase CLI と E2E を Docker 内から実行する service を追加する。 |
| `supabase/config.toml` | ローカル Auth / Realtime 設定。匿名ログインを有効化する。 |
| `supabase/migrations/20260527000100_online_room_schema.sql` | private/public table、index、RLS 基盤、snapshot 型を作る。 |
| `supabase/migrations/20260527000200_online_room_rpc.sql` | create/join/start/seal/reveal/advance/rematch/snapshot RPC を作る。 |
| `supabase/tests/database/online_room_access.test.sql` | 合言葉、RLS、幹事権限、期限と失敗試行抑制を pgTAP で検証する。 |
| `supabase/tests/database/online_room_rules.test.sql` | TypeScript domain と同じ勝敗 fixture を SQL で検証する。 |
| `src/online/types.ts` | UI と gateway が共有するオンライン snapshot / command 型。 |
| `src/online/onlineRoomGateway.ts` | React から利用する非同期 gateway interface。 |
| `src/online/supabaseClient.ts` | 環境変数検証と lazy SDK 読込。 |
| `src/online/supabaseOnlineRoomGateway.ts` | Anonymous Auth、RPC、Realtime、復帰の実装。 |
| `src/online/OnlineBanquet.tsx` | online state machine と既存演出 component の接続。 |
| `src/online/scenes/*.tsx` | 招待作成、合言葉入場、控室、接続状態 UI。 |
| `src/offline/OfflineBanquet.tsx` | 現行 `App.tsx` の一台回し state machine を挙動変更なく保持する。 |
| `src/App.tsx`, `src/scenes/SetupScene.tsx` | 一台回し / オンライン祝宴の入口を分岐する。 |
| `src/styles/game.css` | 招待状と控室を既存世界観に合わせて配置する。 |
| `tests/online/*.test.ts(x)` | gateway 契約、環境変数、オンライン UI の unit tests。 |
| `e2e/online-room.spec.ts` | 2端末による入場、秘密封蝋、公開、復帰、スマホ layout 検査。 |
| `vercel.json`, `README.md` | Vercel SPA 配信と Supabase / deployment 手順。 |

## Task 1: Local Supabase Tooling And Public Environment Boundary

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.env.sample`
- Modify: `.gitignore`
- Modify: `compose.yaml`
- Create: `supabase/config.toml`
- Modify: `README.md`

- [ ] **Step 1: Add a configuration test that rejects secret-bearing client configuration**

Create `tests/online/supabaseClient.test.ts` first:

```ts
import { describe, expect, it } from "vitest";
import { readSupabasePublicConfig } from "../../src/online/supabaseClient";

describe("Supabase public client configuration", () => {
  it("accepts only the project URL and publishable key required by the browser", () => {
    expect(
      readSupabasePublicConfig({
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("fails with a usable message when online configuration is absent", () => {
    expect(() => readSupabasePublicConfig({})).toThrow("オンライン祝宴の接続設定がありません");
  });
});
```

- [ ] **Step 2: Run the new test in Docker and verify RED**

Run:

```bash
docker compose run --rm web npm test -- tests/online/supabaseClient.test.ts
```

Expected: FAIL because `src/online/supabaseClient.ts` does not exist.

- [ ] **Step 3: Add dependencies inside Docker and create the public configuration boundary**

Run, with network access limited to installing the required project dependencies:

```bash
docker compose run --rm web npm install @supabase/supabase-js
docker compose run --rm web npm install --save-dev supabase
```

Create `.env.sample`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Create `src/online/supabaseClient.ts`:

```ts
export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

/** Reads the only Supabase values that may be embedded in a browser build. */
export function readSupabasePublicConfig(
  env: Record<string, string | boolean | undefined>,
): SupabasePublicConfig {
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== "string" || typeof publishableKey !== "string") {
    throw new Error("オンライン祝宴の接続設定がありません");
  }
  return { url, publishableKey };
}
```

Add a `supabase` service to `compose.yaml` with the repository, Node modules volume, and Docker socket mounted so the CLI may start its local service containers without installing tools on the host:

```yaml
  supabase:
    <<: *web-base
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - /var/run/docker.sock:/var/run/docker.sock
    command: npx supabase
```

Initialize configuration through the Docker service:

```bash
docker compose run --rm supabase npx supabase init
```

Set `[auth] enable_anonymous_sign_ins = true` in `supabase/config.toml`, and add `supabase/.temp/` to `.gitignore`.

- [ ] **Step 4: Run the configuration test and verify GREEN**

Run:

```bash
docker compose run --rm web npm test -- tests/online/supabaseClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Document local service commands and commit**

Add README commands:

```bash
docker compose run --rm supabase npx supabase start
docker compose run --rm supabase npx supabase db reset
docker compose run --rm supabase npx supabase test db
```

Commit:

```bash
git add package.json package-lock.json .env.sample .gitignore compose.yaml supabase/config.toml src/online/supabaseClient.ts tests/online/supabaseClient.test.ts README.md
git commit -m "オンライン祝宴のSupabase開発基盤を追加する"
```

## Task 2: Room Schema, Secret Isolation, And RLS

**Files:**
- Create: `supabase/migrations/20260527000100_online_room_schema.sql`
- Create: `supabase/tests/database/online_room_access.test.sql`

- [ ] **Step 1: Write pgTAP assertions for schema security and indices**

Create `supabase/tests/database/online_room_access.test.sql` beginning with:

```sql
begin;
select plan(12);

select has_schema('private', 'private schema exists for invitation verifiers');
select has_table('public', 'rooms', 'rooms table exists');
select has_table('private', 'room_secrets', 'room secrets table exists');
select has_table('private', 'join_attempts', 'join attempt throttling table exists');
select has_table('public', 'room_members', 'room members table exists');
select has_table('public', 'room_bids', 'sealed bids table exists');
select has_table('public', 'room_round_results', 'results table exists');
select isnt_empty(
  $$select 1 from pg_class where relname = 'rooms_invite_code_key'$$,
  'invite codes are unique'
);
select isnt_empty(
  $$select 1 from pg_class where relname = 'room_members_room_user_key'$$,
  'one authenticated identity has only one seat per room'
);
select isnt_empty(
  $$select 1 from pg_class where relname = 'room_bids_round_member_key'$$,
  'one sealed bid exists per member and round'
);
select isnt_empty(
  $$select 1 from pg_class c where c.relname = 'rooms' and c.relrowsecurity$$,
  'rooms enables RLS'
);
select isnt_empty(
  $$select 1 from pg_class c where c.relname = 'room_bids' and c.relrowsecurity$$,
  'bids enable RLS'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Start local Supabase and verify the schema test is RED**

Run:

```bash
docker compose run --rm supabase npx supabase start
docker compose run --rm supabase npx supabase test db supabase/tests/database/online_room_access.test.sql
```

Expected: FAIL because the room schema has not been migrated.

- [ ] **Step 3: Create the migration with private secret storage and RLS-enabled public tables**

Create `supabase/migrations/20260527000100_online_room_schema.sql` with:

```sql
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.banquet_mode as enum ('short', 'full');
create type public.banquet_phase as enum ('lobby', 'selecting', 'revealed', 'finished');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique check (invite_code ~ '^[0-9A-HJKMNP-TV-Z]{10}$'),
  host_user_id uuid not null references auth.users(id),
  mode public.banquet_mode not null,
  phase public.banquet_phase not null default 'lobby',
  round_index integer not null default 0 check (round_index between 0 and 15),
  current_dish_id text,
  revision integer not null default 0,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create table private.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  passphrase_hash text not null
);

create table private.join_attempts (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  attempted_at timestamptz not null default now(),
  accepted boolean not null,
  primary key (room_id, user_id, attempted_at)
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null check (char_length(trim(display_name)) between 1 and 12),
  seat_index integer not null check (seat_index between 0 and 5),
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  constraint room_members_room_user_key unique (room_id, user_id),
  constraint room_members_room_name_key unique (room_id, display_name),
  constraint room_members_room_seat_key unique (room_id, seat_index)
);

create table public.room_dishes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_index integer not null,
  dish_id text not null,
  points integer not null check (points between -5 and 10 and points <> 0),
  primary key (room_id, round_index)
);

create table public.room_bids (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_index integer not null,
  member_id uuid not null references public.room_members(id) on delete cascade,
  bid_value integer not null check (bid_value between 1 and 15),
  sealed_at timestamptz not null default now(),
  constraint room_bids_round_member_key unique (room_id, round_index, member_id)
);

create table public.room_round_results (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_index integer not null,
  outcome jsonb not null,
  revealed_at timestamptz not null default now(),
  primary key (room_id, round_index)
);

create index room_members_user_id_idx on public.room_members (user_id);
create index room_dishes_room_id_idx on public.room_dishes (room_id);
create index room_bids_member_id_idx on public.room_bids (member_id);
create index room_results_room_id_idx on public.room_round_results (room_id);
create index join_attempts_lookup_idx on private.join_attempts (room_id, user_id, attempted_at desc);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_dishes enable row level security;
alter table public.room_bids enable row level security;
alter table public.room_round_results enable row level security;
```

Add membership-based select policies after introducing a private `is_room_member(room_id uuid)` Security Definer helper with fixed `search_path = ''`, revoke default function execution, then grant execute only to `authenticated`.

- [ ] **Step 4: Reset local DB and verify schema tests GREEN**

Run:

```bash
docker compose run --rm supabase npx supabase db reset
docker compose run --rm supabase npx supabase test db supabase/tests/database/online_room_access.test.sql
```

Expected: all 12 pgTAP assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260527000100_online_room_schema.sql supabase/tests/database/online_room_access.test.sql
git commit -m "オンライン祝宴のルームスキーマとRLS基盤を追加する"
```

## Task 3: Transactional Room RPC And Rule Parity

**Files:**
- Create: `supabase/migrations/20260527000200_online_room_rpc.sql`
- Modify: `supabase/tests/database/online_room_access.test.sql`
- Create: `supabase/tests/database/online_room_rules.test.sql`

- [ ] **Step 1: Add failing pgTAP tests for invitation, host permissions, bid secrecy, and round outcome**

Use authenticated JWT claims in pgTAP transactions:

```sql
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_banquet_room('幹事', 'short', '月夜のタルト')$$,
  'host creates a room'
);
select throws_ok(
  $$select public.reveal_banquet_round(current_setting('test.room_id')::uuid)$$,
  'P0001',
  '全員の封蝋を待っています',
  'cannot reveal before every member seals'
);
```

Add fixtures that assert:

```sql
-- positive dish: duplicate 15 bids collide and unique 12 wins
-- negative dish: duplicate 1 bids collide and unique 3 wins
-- all bids collide: winner is null and dish remains unserved
-- a guest cannot call start/reveal/advance/rematch
-- a second guest cannot read the first guest bid before reveal
-- failed phrase attempts are refused after the configured burst threshold
-- expired rooms reject joins and progress
```

- [ ] **Step 2: Run DB tests and verify RED**

Run:

```bash
docker compose run --rm supabase npx supabase test db supabase/tests/database
```

Expected: FAIL because room RPC functions do not exist.

- [ ] **Step 3: Implement RPC functions with fixed search paths and explicit grants**

Create `supabase/migrations/20260527000200_online_room_rpc.sql` defining:

```sql
create or replace function public.create_banquet_room(
  display_name text,
  requested_mode public.banquet_mode,
  passphrase text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  room_id uuid;
  code text;
begin
  if auth.uid() is null or char_length(trim(passphrase)) < 4 then
    raise exception '招待状を作成できません';
  end if;
  code := private.generate_invite_code();
  insert into public.rooms (invite_code, host_user_id, mode)
    values (code, auth.uid(), requested_mode) returning id into room_id;
  insert into private.room_secrets values (room_id, crypt(passphrase, gen_salt('bf')));
  insert into public.room_members (room_id, user_id, display_name, seat_index)
    values (room_id, auth.uid(), trim(display_name), 0);
  return room_id;
end;
$$;
```

Implement `join_banquet_room`, `start_banquet_room`, `seal_banquet_bid`, `reveal_banquet_round`, `advance_banquet_round`, `rematch_banquet_room`, `get_banquet_snapshot`, and `get_my_banquet_hand` so that:

```sql
-- each mutating RPC locks its room before checking phase/revision
select * into target_room from public.rooms where id = room_id for update;
-- joining verifies expires_at, recent failed attempts, crypt(passphrase, passphrase_hash)
-- sealing checks member = auth.uid(), bid unused across prior rounds, phase selecting
-- reveal reads a complete bid set and inserts one JSON result exactly once
-- state updates increment rooms.revision
```

After every function:

```sql
revoke all on function public.function_name(argument_types) from public, anon;
grant execute on function public.function_name(argument_types) to authenticated;
```

- [ ] **Step 4: Verify DB tests GREEN and regenerate local types**

Run:

```bash
docker compose run --rm supabase npx supabase db reset
docker compose run --rm supabase npx supabase test db supabase/tests/database
docker compose run --rm supabase npx supabase gen types typescript --local --schema public > src/online/database.types.ts
```

Expected: pgTAP tests PASS and generated types include the seven public RPC functions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260527000200_online_room_rpc.sql supabase/tests/database src/online/database.types.ts
git commit -m "オンライン祝宴の安全な進行RPCを実装する"
```

## Task 4: Online Gateway With Anonymous Authentication And Reconnect

**Files:**
- Create: `src/online/types.ts`
- Create: `src/online/onlineRoomGateway.ts`
- Modify: `src/online/supabaseClient.ts`
- Create: `src/online/supabaseOnlineRoomGateway.ts`
- Create: `tests/online/onlineRoomGateway.test.ts`

- [ ] **Step 1: Define failing gateway contract tests with a mocked Supabase port**

Create tests that assert:

```ts
it("signs in anonymously before creating an invitation", async () => {
  const port = createFakeSupabasePort();
  const gateway = createSupabaseOnlineRoomGateway(port);
  await gateway.createRoom({ displayName: "幹事", mode: "short", passphrase: "月夜のタルト" });
  expect(port.calls).toEqual(["signInAnonymously", "create_banquet_room", "get_banquet_snapshot"]);
});

it("refreshes a snapshot after a room change without exposing sealed bid values", async () => {
  const gateway = createSupabaseOnlineRoomGateway(createFakeSupabasePort());
  const updated = await gateway.observeRoom("room-1", vi.fn());
  expect(updated.privateValuesFromOtherPlayers).toBeUndefined();
});
```

- [ ] **Step 2: Run gateway tests and verify RED**

```bash
docker compose run --rm web npm test -- tests/online/onlineRoomGateway.test.ts
```

Expected: FAIL because online types and gateway do not exist.

- [ ] **Step 3: Implement focused async contracts**

Create `src/online/types.ts`:

```ts
import type { BidValue, Dish, GameMode, RankedPlayer, RoundOutcome } from "../domain/types";

export type OnlinePhase = "lobby" | "selecting" | "revealed" | "finished";

export interface OnlineRoomSnapshot {
  roomId: string;
  inviteCode: string;
  mode: GameMode;
  phase: OnlinePhase;
  isHost: boolean;
  roundNumber: number;
  dishCount: number;
  currentDish?: Dish;
  members: Array<{ id: string; displayName: string; score: number; sealed: boolean }>;
  revealedOutcome?: RoundOutcome;
  rankings?: RankedPlayer[];
}

export interface OnlinePrivateHand {
  memberId: string;
  displayName: string;
  remainingBids: BidValue[];
}
```

Create `src/online/onlineRoomGateway.ts`:

```ts
import type { BidValue, GameMode } from "../domain/types";
import type { OnlinePrivateHand, OnlineRoomSnapshot } from "./types";

export interface OnlineRoomGateway {
  restoreRoom(): Promise<OnlineRoomSnapshot | undefined>;
  createRoom(input: { displayName: string; mode: GameMode; passphrase: string }): Promise<OnlineRoomSnapshot>;
  joinRoom(input: { inviteCode: string; passphrase: string; displayName: string }): Promise<OnlineRoomSnapshot>;
  startRoom(roomId: string): Promise<OnlineRoomSnapshot>;
  getMyHand(roomId: string): Promise<OnlinePrivateHand>;
  sealBid(roomId: string, bid: BidValue): Promise<OnlineRoomSnapshot>;
  revealRound(roomId: string): Promise<OnlineRoomSnapshot>;
  advanceRound(roomId: string): Promise<OnlineRoomSnapshot>;
  rematch(roomId: string): Promise<OnlineRoomSnapshot>;
  subscribe(roomId: string, onSnapshot: (snapshot: OnlineRoomSnapshot) => void): () => void;
}
```

Implement the Supabase gateway so that `@supabase/supabase-js` is loaded from an async factory only after entering online mode, every RPC error is converted into a Japanese user message, and Realtime notifications call `get_banquet_snapshot` rather than rendering raw payload values.

- [ ] **Step 4: Verify tests and bundle split**

```bash
docker compose run --rm web npm test -- tests/online
docker compose run --rm web npm run build
```

Expected: online tests PASS; build output has a separate Supabase online chunk not loaded by the initial offline entry path.

- [ ] **Step 5: Commit**

```bash
git add src/online tests/online
git commit -m "オンライン祝宴の非同期セッション接続を実装する"
```

## Task 5: Online Visual Baseline And Entry Screens

**Files:**
- Create: `docs/design/assets/midnight-buffet-online-lobby-reference.png`
- Create: `docs/design/midnight-buffet-online-visual-reference.md`
- Modify: `src/App.tsx`
- Create: `src/offline/OfflineBanquet.tsx`
- Modify: `src/scenes/SetupScene.tsx`
- Create: `src/online/OnlineBanquet.tsx`
- Create: `src/online/scenes/OnlineEntryScene.tsx`
- Create: `src/online/scenes/LobbyScene.tsx`
- Modify: `src/styles/game.css`
- Modify: `tests/ui/App.test.tsx`
- Create: `tests/online/OnlineBanquet.test.tsx`

- [ ] **Step 1: Generate and approve the online visual reference before UI coding**

Use `imagegen-ui-design-first` and `imagegen` to generate a portrait mobile reference depicting the existing midnight banquet stage with a gold-edged invitation panel and velvet waiting room. Record the world vocabulary:

```markdown
招待状 / 合言葉 / 控室 / 幹事 / 封蝋 / クロッシュ / 金の光 / ベルベット
```

Save the selected baseline to `docs/design/assets/midnight-buffet-online-lobby-reference.png` and its design notes to `docs/design/midnight-buffet-online-visual-reference.md`.

- [ ] **Step 2: Write failing React tests for mode choice, invitation creation, and lobby host controls**

Add assertions:

```tsx
expect(screen.getByRole("button", { name: "この端末で遊ぶ" })).toBeVisible();
expect(screen.getByRole("button", { name: "オンライン祝宴" })).toBeVisible();
await user.click(screen.getByRole("button", { name: "オンライン祝宴" }));
expect(screen.getByRole("button", { name: "招待状を作る" })).toBeVisible();
expect(screen.getByRole("button", { name: "合言葉で入場" })).toBeVisible();
```

Mock `OnlineRoomGateway` and assert the host lobby renders `招待コード` and enables `開宴する` only after two members exist.

- [ ] **Step 3: Run UI tests and verify RED**

```bash
docker compose run --rm web npm test -- tests/ui/App.test.tsx tests/online/OnlineBanquet.test.tsx
```

Expected: FAIL because online entry and lobby screens do not exist.

- [ ] **Step 4: Implement the mode entrance and lobby surfaces**

Refactor only the setup entrance:

```tsx
type PlayStyle = "offline" | "online";
const [playStyle, setPlayStyle] = useState<PlayStyle>();

return (
  <>
    {!playStyle && (
      <PlayStyleScene
        onOffline={() => setPlayStyle("offline")}
        onOnline={() => setPlayStyle("online")}
      />
    )}
    {playStyle === "offline" && <OfflineBanquet onExit={() => setPlayStyle(undefined)} shuffle={shuffle} />}
    {playStyle === "online" && <OnlineBanquet onExit={() => setPlayStyle(undefined)} />}
  </>
);
```

Move the current `App` local-session coordinator into `src/offline/OfflineBanquet.tsx` without changing its adapter calls, labels, or `shuffle` prop consumed by existing tests. Use existing panel/button tokens for `OnlineEntryScene` and `LobbyScene`; show:

```tsx
<h1>オンライン祝宴</h1>
<button>招待状を作る</button>
<button>合言葉で入場</button>
<p>合言葉は口頭で伝え、公開画面には残しません。</p>
```

Keep the dish stage anchored above the online panels and calculate the lobby button containment using the same test-id bounding-box pattern as the existing layout E2E.

- [ ] **Step 5: Verify unit tests and both mobile viewports, then commit**

```bash
docker compose run --rm web npm test -- tests/ui tests/online
docker compose run --rm e2e npx playwright test e2e/online-room.spec.ts --grep "entry|lobby"
```

Expected: PASS and screenshots show the reference invitation/control vocabulary without overflow at `390x844` and `430x932`.

```bash
git add docs/design src/App.tsx src/scenes/SetupScene.tsx src/online src/styles/game.css tests e2e/online-room.spec.ts
git commit -m "オンライン祝宴の招待状と控室画面を実装する"
```

## Task 6: Multi-Device Sealing, Host Reveal, Results, And Reconnect UI

**Files:**
- Modify: `src/online/OnlineBanquet.tsx`
- Create: `src/online/scenes/OnlineSelectionScene.tsx`
- Create: `src/online/scenes/OnlineWaitingScene.tsx`
- Create: `src/online/scenes/OnlineReconnectScene.tsx`
- Modify: `src/styles/game.css`
- Modify: `tests/online/OnlineBanquet.test.tsx`
- Modify: `e2e/online-room.spec.ts`

- [ ] **Step 1: Add failing UI tests using two fake gateways**

Test exact behavior:

```tsx
expect(guestScreen.queryByText("幹事の予約札 15")).not.toBeInTheDocument();
expect(hostScreen.getByText("れん さんは封蝋済み")).toBeVisible();
expect(hostScreen.getByRole("button", { name: "クロッシュを開ける" })).toBeEnabled();
expect(guestScreen.queryByRole("button", { name: "クロッシュを開ける" })).not.toBeInTheDocument();
expect(restoredScreen.getByText("席へ戻りました")).toBeVisible();
```

- [ ] **Step 2: Run tests and verify RED**

```bash
docker compose run --rm web npm test -- tests/online/OnlineBanquet.test.tsx
```

Expected: FAIL because gameplay and reconnect scenes are not wired.

- [ ] **Step 3: Implement online gameplay scene orchestration**

`OnlineBanquet` must:

```ts
// load private hand only for the authenticated player's selecting screen
// call gateway.sealBid() and replace the hand with a sealed waiting state
// render reveal/advance/rematch actions only when snapshot.isHost is true
// run gateway.restoreRoom() on online entry and show OnlineReconnectScene while pending
// unsubscribe Realtime listeners on unmount or room exit
```

Reuse `DishStage`, `ReservationCard`, and `ScoreBoard` so online mode preserves the generated banquet stage and scoring language. Do not pass another member's `bid_value` into a selecting or waiting scene.

- [ ] **Step 4: Verify unit tests GREEN**

```bash
docker compose run --rm web npm test -- tests/online tests/ui
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/online src/styles/game.css tests/online
git commit -m "オンライン祝宴の封蝋と幹事公開を実装する"
```

## Task 7: Actual Local Supabase Two-Device E2E And Regression Gate

**Files:**
- Modify: `playwright.config.ts`
- Create: `e2e/online-room.spec.ts`
- Modify: `compose.yaml`
- Modify: `README.md`

- [ ] **Step 1: Add a Playwright test that drives host and guest browser contexts**

Use a test-only local Supabase URL and publishable key supplied through Docker environment variables:

```ts
test("host and guest seal privately, reveal together, and guest reconnects", async ({ browser }) => {
  const host = await browser.newPage();
  const guest = await browser.newPage();
  await host.goto("./?qa=online-host");
  await guest.goto("./?qa=online-guest");
  // host creates invite, guest joins with copied visible invite code and known test phrase
  // both seal a card; assert neither sees the other's value before host reveal
  // host reveals and both see the same public outcome
  // guest reloads and returns to the current room
});
```

Add bounding-box assertions for invitation, lobby, sealed waiting, and reveal panels at both configured phone viewports.

- [ ] **Step 2: Run E2E against local Supabase and verify RED until wiring is complete**

Add services whose Vite process receives the public online configuration:

```yaml
  web-online-internal:
    <<: *web-base
    environment:
      - CHOKIDAR_USEPOLLING=true
      - VITE_SUPABASE_URL
      - VITE_SUPABASE_PUBLISHABLE_KEY

  e2e-online:
    image: mcr.microsoft.com/playwright:v1.60.0-noble
    working_dir: /app
    depends_on:
      - web-online-internal
    volumes:
      - .:/app
      - e2e_node_modules:/app/node_modules
    environment:
      - PLAYWRIGHT_BASE_URL=http://web-online-internal:5173
    command: sh -c "npm ci && npm run test:e2e"
```

```bash
docker compose run --rm supabase npx supabase start
docker compose run --rm supabase npx supabase db reset
LOCAL_SUPABASE_ENV="$(docker compose run --rm supabase npx supabase status -o env)"
LOCAL_SUPABASE_URL="$(printf '%s\n' "$LOCAL_SUPABASE_ENV" | sed -n 's/^API_URL="\\(.*\\)"/\\1/p')"
LOCAL_SUPABASE_KEY="$(printf '%s\n' "$LOCAL_SUPABASE_ENV" | sed -n 's/^ANON_KEY="\\(.*\\)"/\\1/p')"
VITE_SUPABASE_URL="$LOCAL_SUPABASE_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$LOCAL_SUPABASE_KEY" docker compose run --rm e2e-online npx playwright test e2e/online-room.spec.ts
```

Expected before complete integration: FAIL at online invitation or synchronization assertions.

- [ ] **Step 3: Wire E2E environment into Vite container without exposing secrets**

Pass only the local public client values into `web-online-internal` for the online E2E profile. Obtain the local anon/publishable-compatible key from `npx supabase status -o env`, keep it only in shell variables for the command, and do not commit generated values. Production uses a publishable key, never a legacy secret or `service_role` value.

- [ ] **Step 4: Run complete regression verification**

Run:

```bash
docker compose run --rm supabase npx supabase db reset
docker compose run --rm supabase npx supabase test db supabase/tests/database
docker compose run --rm web npm test
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
docker compose run --rm e2e npx playwright test e2e/pass-and-play.spec.ts
VITE_SUPABASE_URL="$LOCAL_SUPABASE_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$LOCAL_SUPABASE_KEY" docker compose run --rm e2e-online npx playwright test e2e/online-room.spec.ts
```

Expected: database tests, unit tests, lint, build, offline E2E and online two-device E2E all PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/online-room.spec.ts compose.yaml README.md
git commit -m "オンライン祝宴を複数端末で検証する"
```

## Task 8: Vercel Release Preparation And Production Approval Gate

**Files:**
- Create: `vercel.json`
- Modify: `README.md`
- Modify: `.github/workflows/deploy-pages.yml` only if offline Pages compatibility needs documentation or unchanged-build verification

- [ ] **Step 1: Add Vercel SPA deployment configuration and documentation**

Create `vercel.json`:

```json
{
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Document these Vercel environment variables only:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Explicitly document that `service_role`, secret API keys, and passphrase verifier values must not be added to Vercel client environment variables.

- [ ] **Step 2: Run pre-publish checks on staged changes**

```bash
git diff --cached --check
git diff --cached -U0 --no-color | rg -n -i "(api[_-]?key|secret|token|password|passwd|client_secret|private_key)"
git diff --cached -U0 --no-color | rg -n -- "-----BEGIN [A-Z ]*PRIVATE KEY-----|A(KIA|SIA)[0-9A-Z]{16}|https?://[^/\\s:]+:[^/\\s@]+@"
git diff --cached --name-only | rg -n "(?i)(\\.env|\\.pem|\\.key|\\.p12|\\.pfx|\\.jks|id_rsa|id_dsa|id_ecdsa)"
```

Expected: only documentation wording such as `secret key を設定しない` may match the keyword scan; no credential value, private key, basic-auth URL, or sensitive file is staged.

- [ ] **Step 3: Commit release preparation**

```bash
git add vercel.json README.md
git commit -m "Vercel公開の設定と安全手順を追加する"
```

- [ ] **Step 4: Request explicit approval before production operations**

Before creating or linking a Supabase production project, applying migrations to a remote database, configuring Vercel production environment values, or deploying a production Vercel URL, present:

```text
実行予定: Supabase 本番 project 作成/接続、migration 適用、Vercel project 接続と production deploy
公開値: VITE_SUPABASE_URL と publishable key のみ
非公開値: service_role/secret key、合言葉 verifier
検証: preview URL の2端末 E2E 後に production 昇格
```

Proceed only after the user explicitly approves these production effects.

## Final Verification Checklist

- [ ] `REQ-001`〜`REQ-010`: 一台回し版が Pages URL で継続稼働し、offline E2E が通る。
- [ ] `REQ-011`〜`REQ-013`: オンライン入口、招待、幹事進行が2端末 E2E で通る。
- [ ] `REQ-014`〜`REQ-015`: 合言葉と公開前の他人の札が DB tests と E2E で非露出である。
- [ ] `REQ-016`: guest reload による席復帰が E2E で通る。
- [ ] `REQ-017`: Vercel build に publishable client values 以外の secret が存在しない。
- [ ] `REQ-018`: DB tests / unit / lint / build / offline E2E / online E2E がすべて通る。
- [ ] `REQ-019`: 10文字コード、入場失敗試行抑制、24時間失効が DB tests で通る。
- [ ] `390x844` と `430x932` のオンライン主要画面スクリーンショットを目視し、パネル境界値検査を通す。
- [ ] production migration / Vercel deployment は承認後にのみ実施する。
