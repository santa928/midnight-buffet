create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.banquet_mode as enum ('short', 'full');
create type public.banquet_phase as enum ('lobby', 'selecting', 'revealed', 'finished');

create table public.rooms (
  id uuid primary key default extensions.gen_random_uuid(),
  invite_code text not null constraint rooms_invite_code_key unique
    check (invite_code ~ '^[0-9A-HJKMNP-TV-Z]{10}$'),
  host_user_id uuid not null references auth.users(id),
  mode public.banquet_mode not null,
  phase public.banquet_phase not null default 'lobby',
  round_index integer not null default 0 check (round_index between 0 and 14),
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
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  attempted_at timestamptz not null default now(),
  accepted boolean not null
);

create table public.room_members (
  id uuid primary key default extensions.gen_random_uuid(),
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
  round_index integer not null check (round_index between 0 and 14),
  dish_id text not null,
  points integer not null check (points between -5 and 10 and points <> 0),
  primary key (room_id, round_index)
);

create table public.room_bids (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_index integer not null check (round_index between 0 and 14),
  member_id uuid not null references public.room_members(id) on delete cascade,
  bid_value integer not null check (bid_value between 1 and 15),
  sealed_at timestamptz not null default now(),
  constraint room_bids_round_member_key unique (room_id, round_index, member_id),
  constraint room_bids_member_card_key unique (room_id, member_id, bid_value)
);

create table public.room_round_results (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_index integer not null check (round_index between 0 and 14),
  outcome jsonb not null,
  revealed_at timestamptz not null default now(),
  primary key (room_id, round_index)
);

-- Realtime payload is only a refresh signal; clients retrieve a protected RPC snapshot.
alter publication supabase_realtime add table public.rooms;

create index room_members_user_id_idx on public.room_members (user_id);
create index room_dishes_room_id_idx on public.room_dishes (room_id);
create index room_bids_member_id_idx on public.room_bids (member_id);
create index room_results_room_id_idx on public.room_round_results (room_id);
create index join_attempts_lookup_idx
  on private.join_attempts (room_id, user_id, attempted_at desc);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_dishes enable row level security;
alter table public.room_bids enable row level security;
alter table public.room_round_results enable row level security;

create or replace function private.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members members
    where members.room_id = p_room_id
      and members.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_round_revealed(p_room_id uuid, p_round_index integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_round_results results
    where results.room_id = p_room_id
      and results.round_index = p_round_index
  );
$$;

revoke all on function private.is_room_member(uuid) from public, anon, authenticated;
revoke all on function private.is_round_revealed(uuid, integer) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_room_member(uuid) to authenticated;
grant execute on function private.is_round_revealed(uuid, integer) to authenticated;

create policy "members read their room"
  on public.rooms for select to authenticated
  using (private.is_room_member(id));

create policy "members read room seats"
  on public.room_members for select to authenticated
  using (private.is_room_member(room_id));

create policy "members read room dishes"
  on public.room_dishes for select to authenticated
  using (private.is_room_member(room_id));

create policy "members read revealed results"
  on public.room_round_results for select to authenticated
  using (private.is_room_member(room_id));

create policy "members read own or revealed bids"
  on public.room_bids for select to authenticated
  using (
    private.is_room_member(room_id)
    and (
      private.is_round_revealed(room_id, round_index)
      or member_id in (
        select members.id
        from public.room_members members
        where members.room_id = room_bids.room_id
          and members.user_id = (select auth.uid())
      )
    )
  );

revoke all on table public.rooms, public.room_members, public.room_dishes,
  public.room_bids, public.room_round_results from public, anon, authenticated;
grant select on table public.rooms, public.room_members, public.room_dishes,
  public.room_bids, public.room_round_results to authenticated;
revoke all on table private.room_secrets, private.join_attempts from public, anon, authenticated;
