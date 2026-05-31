create or replace function private.generate_invite_code()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.string_agg(
    pg_catalog.substr(
      '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
      (pg_catalog.get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1,
      1
    ),
    ''
  )
  from pg_catalog.generate_series(1, 10);
$$;

revoke all on function private.generate_invite_code() from public, anon, authenticated;

create or replace function public.get_banquet_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  snapshot jsonb;
begin
  if (select auth.uid()) is null or not private.is_room_member(p_room_id) then
    raise exception '祝宴へ入場していません';
  end if;

  select * into target_room
  from public.rooms rooms
  where rooms.id = p_room_id;

  if not found then
    raise exception '招待状を確認してください';
  end if;

  select pg_catalog.jsonb_build_object(
    'roomId', target_room.id,
    'inviteCode', target_room.invite_code,
    'mode', target_room.mode,
    'phase', target_room.phase,
    'roundIndex', target_room.round_index,
    'revision', target_room.revision,
    'isHost', target_room.host_user_id = (select auth.uid()),
    'members', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', members.id,
          'displayName', members.display_name,
          'seatIndex', members.seat_index,
          'score', members.score,
          'isMe', members.user_id = (select auth.uid())
        )
        order by members.seat_index
      )
      from public.room_members members
      where members.room_id = target_room.id
    ), '[]'::jsonb),
    'currentDish', (
      select pg_catalog.jsonb_build_object(
        'id', dishes.dish_id,
        'points', dishes.points,
        'kind', case when dishes.points > 0 then 'positive' else 'negative' end
      )
      from public.room_dishes dishes
      where dishes.room_id = target_room.id
        and dishes.round_index = target_room.round_index
    ),
    'sealedMemberIds', coalesce((
      select pg_catalog.jsonb_agg(bids.member_id order by members.seat_index)
      from public.room_bids bids
      join public.room_members members on members.id = bids.member_id
      where bids.room_id = target_room.id
        and bids.round_index = target_room.round_index
    ), '[]'::jsonb),
    'revealedOutcome', (
      select results.outcome
      from public.room_round_results results
      where results.room_id = target_room.id
        and results.round_index = target_room.round_index
    )
  ) into snapshot;

  return snapshot;
end;
$$;

create or replace function public.get_my_banquet_hand(p_room_id uuid)
returns integer[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_member_id uuid;
  remaining_cards integer[];
begin
  select members.id into current_member_id
  from public.room_members members
  where members.room_id = p_room_id
    and members.user_id = (select auth.uid());

  if current_member_id is null then
    raise exception '祝宴へ入場していません';
  end if;

  select coalesce(pg_catalog.array_agg(cards.card order by cards.card), '{}'::integer[])
    into remaining_cards
  from pg_catalog.generate_series(1, 15) as cards(card)
  where not exists (
    select 1
    from public.room_bids bids
    where bids.room_id = p_room_id
      and bids.member_id = current_member_id
      and bids.bid_value = cards.card
  );

  return remaining_cards;
end;
$$;

create or replace function public.create_banquet_room(
  p_display_name text,
  p_requested_mode public.banquet_mode,
  p_passphrase text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_id uuid;
  invitation text;
begin
  if (select auth.uid()) is null
    or pg_catalog.char_length(pg_catalog.btrim(p_display_name)) not between 1 and 12
    or pg_catalog.char_length(pg_catalog.btrim(p_passphrase)) < 4 then
    raise exception '招待状を作成できません';
  end if;

  loop
    invitation := private.generate_invite_code();
    begin
      insert into public.rooms (invite_code, host_user_id, mode)
      values (invitation, (select auth.uid()), p_requested_mode)
      returning id into room_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into private.room_secrets (room_id, passphrase_hash)
  values (room_id, extensions.crypt(p_passphrase, extensions.gen_salt('bf')));

  insert into public.room_members (room_id, user_id, display_name, seat_index)
  values (room_id, (select auth.uid()), pg_catalog.btrim(p_display_name), 0);

  return pg_catalog.jsonb_build_object('roomId', room_id, 'inviteCode', invitation);
end;
$$;

create or replace function public.join_banquet_room(
  p_invite_code text,
  p_display_name text,
  p_passphrase text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  secret_hash text;
  next_seat integer;
  failed_count integer;
begin
  if (select auth.uid()) is null
    or pg_catalog.char_length(pg_catalog.btrim(p_display_name)) not between 1 and 12 then
    return null;
  end if;

  select * into target_room
  from public.rooms rooms
  where rooms.invite_code = pg_catalog.upper(pg_catalog.btrim(p_invite_code))
  for update;

  if not found or target_room.phase <> 'lobby' or target_room.expires_at <= now() then
    return null;
  end if;

  if exists (
    select 1 from public.room_members members
    where members.room_id = target_room.id
      and members.user_id = (select auth.uid())
  ) then
    return target_room.id;
  end if;

  select pg_catalog.count(*) into failed_count
  from private.join_attempts attempts
  where attempts.room_id = target_room.id
    and attempts.user_id = (select auth.uid())
    and not attempts.accepted
    and attempts.attempted_at > now() - interval '10 minutes';

  if failed_count >= 5 then
    return null;
  end if;

  select secrets.passphrase_hash into secret_hash
  from private.room_secrets secrets
  where secrets.room_id = target_room.id;

  if secret_hash is null
    or extensions.crypt(p_passphrase, secret_hash) <> secret_hash then
    insert into private.join_attempts (room_id, user_id, accepted)
    values (target_room.id, (select auth.uid()), false);
    return null;
  end if;

  if exists (
    select 1 from public.room_members members
    where members.room_id = target_room.id
      and members.display_name = pg_catalog.btrim(p_display_name)
  ) or (
    select pg_catalog.count(*) from public.room_members members
    where members.room_id = target_room.id
  ) >= 6 then
    return null;
  end if;

  select coalesce(pg_catalog.max(members.seat_index), -1) + 1 into next_seat
  from public.room_members members
  where members.room_id = target_room.id;

  insert into public.room_members (room_id, user_id, display_name, seat_index)
  values (target_room.id, (select auth.uid()), pg_catalog.btrim(p_display_name), next_seat);
  insert into private.join_attempts (room_id, user_id, accepted)
  values (target_room.id, (select auth.uid()), true);

  update public.rooms
  set revision = revision + 1
  where id = target_room.id;

  return target_room.id;
end;
$$;

create or replace function public.start_banquet_room(
  p_room_id uuid,
  p_expected_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  member_count integer;
begin
  select * into target_room from public.rooms rooms where rooms.id = p_room_id for update;
  if not found or target_room.host_user_id <> (select auth.uid()) then
    raise exception '幹事だけが開宴できます';
  end if;
  if target_room.expires_at <= now() or target_room.phase <> 'lobby' then
    raise exception 'この招待状では開宴できません';
  end if;
  if p_expected_revision is not null and p_expected_revision <> target_room.revision then
    raise exception '画面を更新してください';
  end if;

  select pg_catalog.count(*) into member_count
  from public.room_members members
  where members.room_id = p_room_id;
  if member_count not between 2 and 6 then
    raise exception '2人以上で開宴してください';
  end if;

  insert into public.room_dishes (room_id, round_index, dish_id, points)
  select p_room_id,
    pg_catalog.row_number() over (order by extensions.gen_random_uuid()) - 1,
    'dish-' || case when menu.points > 0 then 'plus-' else 'minus-' end
      || pg_catalog.abs(menu.points),
    menu.points
  from pg_catalog.unnest(
    case when target_room.mode = 'short'
      then array[1, 2, 3, 4, 5, 6, -1, -2, -3]
      else array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1, -2, -3, -4, -5]
    end
  ) as menu(points);

  update public.rooms rooms
  set phase = 'selecting',
      round_index = 0,
      current_dish_id = dishes.dish_id,
      revision = rooms.revision + 1
  from public.room_dishes dishes
  where rooms.id = p_room_id
    and dishes.room_id = rooms.id
    and dishes.round_index = 0;

  return public.get_banquet_snapshot(p_room_id);
end;
$$;

create or replace function public.seal_banquet_bid(
  p_room_id uuid,
  p_bid_value integer,
  p_expected_round_index integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  member_id uuid;
begin
  select * into target_room from public.rooms rooms where rooms.id = p_room_id for update;
  if not found or target_room.expires_at <= now() or target_room.phase <> 'selecting' then
    raise exception '現在は封蝋できません';
  end if;
  if p_expected_round_index is not null and p_expected_round_index <> target_room.round_index then
    raise exception '画面を更新してください';
  end if;

  select members.id into member_id
  from public.room_members members
  where members.room_id = p_room_id
    and members.user_id = (select auth.uid());
  if member_id is null then
    raise exception '祝宴へ入場していません';
  end if;

  insert into public.room_bids (room_id, round_index, member_id, bid_value)
  values (p_room_id, target_room.round_index, member_id, p_bid_value);

  update public.rooms set revision = revision + 1 where id = p_room_id;
  return public.get_banquet_snapshot(p_room_id);
exception when unique_violation then
  raise exception 'その予約札は封蝋済みです';
end;
$$;

create or replace function public.reveal_banquet_round(
  p_room_id uuid,
  p_expected_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  dish public.room_dishes%rowtype;
  member_count integer;
  bid_count integer;
  winner_id uuid;
  collided jsonb;
  selections jsonb;
  outcome jsonb;
begin
  select * into target_room from public.rooms rooms where rooms.id = p_room_id for update;
  if not found or target_room.host_user_id <> (select auth.uid()) then
    raise exception '幹事だけがクロッシュを開けられます';
  end if;
  if target_room.expires_at <= now() or target_room.phase <> 'selecting' then
    raise exception '現在は公開できません';
  end if;
  if p_expected_revision is not null and p_expected_revision <> target_room.revision then
    raise exception '画面を更新してください';
  end if;

  select pg_catalog.count(*) into member_count
  from public.room_members members where members.room_id = p_room_id;
  select pg_catalog.count(*) into bid_count
  from public.room_bids bids
  where bids.room_id = p_room_id and bids.round_index = target_room.round_index;
  if member_count <> bid_count then
    raise exception '全員の封蝋を待っています';
  end if;

  select * into dish from public.room_dishes dishes
  where dishes.room_id = p_room_id and dishes.round_index = target_room.round_index;

  select coalesce(pg_catalog.jsonb_agg(repeated.bid_value order by repeated.bid_value), '[]'::jsonb)
  into collided
  from (
    select bids.bid_value
    from public.room_bids bids
    where bids.room_id = p_room_id and bids.round_index = target_room.round_index
    group by bids.bid_value having pg_catalog.count(*) > 1
  ) repeated;

  select bids.member_id into winner_id
  from public.room_bids bids
  where bids.room_id = p_room_id
    and bids.round_index = target_room.round_index
    and not exists (
      select 1 from public.room_bids competing
      where competing.room_id = bids.room_id
        and competing.round_index = bids.round_index
        and competing.bid_value = bids.bid_value
        and competing.member_id <> bids.member_id
    )
  order by
    case when dish.points > 0 then bids.bid_value end desc,
    case when dish.points < 0 then bids.bid_value end asc
  limit 1;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'memberId', bids.member_id,
      'displayName', members.display_name,
      'bid', bids.bid_value
    ) order by members.seat_index
  ) into selections
  from public.room_bids bids
  join public.room_members members on members.id = bids.member_id
  where bids.room_id = p_room_id and bids.round_index = target_room.round_index;

  outcome := pg_catalog.jsonb_build_object(
    'dish', pg_catalog.jsonb_build_object(
      'id', dish.dish_id,
      'points', dish.points,
      'kind', case when dish.points > 0 then 'positive' else 'negative' end
    ),
    'selections', selections,
    'collidedBids', collided,
    'winnerId', winner_id,
    'unserved', winner_id is null
  );

  insert into public.room_round_results (room_id, round_index, outcome)
  values (p_room_id, target_room.round_index, outcome);
  if winner_id is not null then
    update public.room_members
    set score = score + dish.points
    where id = winner_id;
  end if;
  update public.rooms set phase = 'revealed', revision = revision + 1 where id = p_room_id;

  return public.get_banquet_snapshot(p_room_id);
end;
$$;

create or replace function public.advance_banquet_round(
  p_room_id uuid,
  p_expected_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
  dish_count integer;
begin
  select * into target_room from public.rooms rooms where rooms.id = p_room_id for update;
  if not found or target_room.host_user_id <> (select auth.uid()) then
    raise exception '幹事だけが次の皿へ進めます';
  end if;
  if target_room.expires_at <= now() or target_room.phase <> 'revealed' then
    raise exception '現在は次の皿へ進めません';
  end if;
  if p_expected_revision is not null and p_expected_revision <> target_room.revision then
    raise exception '画面を更新してください';
  end if;

  select pg_catalog.count(*) into dish_count from public.room_dishes dishes
  where dishes.room_id = p_room_id;
  if target_room.round_index + 1 >= dish_count then
    update public.rooms set phase = 'finished', revision = revision + 1 where id = p_room_id;
  else
    update public.rooms rooms
    set phase = 'selecting',
        round_index = target_room.round_index + 1,
        current_dish_id = dishes.dish_id,
        revision = rooms.revision + 1
    from public.room_dishes dishes
    where rooms.id = p_room_id
      and dishes.room_id = rooms.id
      and dishes.round_index = target_room.round_index + 1;
  end if;

  return public.get_banquet_snapshot(p_room_id);
end;
$$;

create or replace function public.rematch_banquet_room(
  p_room_id uuid,
  p_expected_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.rooms%rowtype;
begin
  select * into target_room from public.rooms rooms where rooms.id = p_room_id for update;
  if not found or target_room.host_user_id <> (select auth.uid()) then
    raise exception '幹事だけが再戦を始められます';
  end if;
  if target_room.expires_at <= now() or target_room.phase <> 'finished' then
    raise exception '現在は再戦できません';
  end if;
  if p_expected_revision is not null and p_expected_revision <> target_room.revision then
    raise exception '画面を更新してください';
  end if;

  delete from public.room_round_results where room_id = p_room_id;
  delete from public.room_bids where room_id = p_room_id;
  delete from public.room_dishes where room_id = p_room_id;
  update public.room_members set score = 0 where room_id = p_room_id;

  insert into public.room_dishes (room_id, round_index, dish_id, points)
  select p_room_id,
    pg_catalog.row_number() over (order by extensions.gen_random_uuid()) - 1,
    'dish-' || case when menu.points > 0 then 'plus-' else 'minus-' end
      || pg_catalog.abs(menu.points),
    menu.points
  from pg_catalog.unnest(
    case when target_room.mode = 'short'
      then array[1, 2, 3, 4, 5, 6, -1, -2, -3]
      else array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1, -2, -3, -4, -5]
    end
  ) as menu(points);

  update public.rooms rooms
  set phase = 'selecting',
      round_index = 0,
      current_dish_id = dishes.dish_id,
      revision = rooms.revision + 1
  from public.room_dishes dishes
  where rooms.id = p_room_id
    and dishes.room_id = rooms.id
    and dishes.round_index = 0;

  return public.get_banquet_snapshot(p_room_id);
end;
$$;

revoke all on function public.get_banquet_snapshot(uuid) from public, anon;
revoke all on function public.get_my_banquet_hand(uuid) from public, anon;
revoke all on function public.create_banquet_room(text, public.banquet_mode, text) from public, anon;
revoke all on function public.join_banquet_room(text, text, text) from public, anon;
revoke all on function public.start_banquet_room(uuid, integer) from public, anon;
revoke all on function public.seal_banquet_bid(uuid, integer, integer) from public, anon;
revoke all on function public.reveal_banquet_round(uuid, integer) from public, anon;
revoke all on function public.advance_banquet_round(uuid, integer) from public, anon;
revoke all on function public.rematch_banquet_room(uuid, integer) from public, anon;

grant execute on function public.get_banquet_snapshot(uuid) to authenticated;
grant execute on function public.get_my_banquet_hand(uuid) to authenticated;
grant execute on function public.create_banquet_room(text, public.banquet_mode, text) to authenticated;
grant execute on function public.join_banquet_room(text, text, text) to authenticated;
grant execute on function public.start_banquet_room(uuid, integer) to authenticated;
grant execute on function public.seal_banquet_bid(uuid, integer, integer) to authenticated;
grant execute on function public.reveal_banquet_round(uuid, integer) to authenticated;
grant execute on function public.advance_banquet_round(uuid, integer) to authenticated;
grant execute on function public.rematch_banquet_room(uuid, integer) to authenticated;
