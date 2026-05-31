begin;

select plan(19);

insert into auth.users (id)
values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004');

create temporary table banquet_fixture (
  room_id uuid not null,
  invite_code text not null
);
grant select, insert on banquet_fixture to authenticated;

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select lives_ok(
  $$insert into banquet_fixture
    select (invitation->>'roomId')::uuid, invitation->>'inviteCode'
    from (select public.create_banquet_room('幹事', 'short', '月夜のタルト') as invitation) created$$,
  'host creates an invitation'
);
select is(
  (select char_length(invite_code) from banquet_fixture),
  10,
  'invitation code has ten characters'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
select is(
  public.join_banquet_room((select invite_code from banquet_fixture), '侵入者', 'まちがい'),
  null::uuid,
  'wrong passphrase does not reveal a room'
);
do $$
begin
  perform public.join_banquet_room((select invite_code from banquet_fixture), '侵入者', 'まちがい');
  perform public.join_banquet_room((select invite_code from banquet_fixture), '侵入者', 'まちがい');
  perform public.join_banquet_room((select invite_code from banquet_fixture), '侵入者', 'まちがい');
  perform public.join_banquet_room((select invite_code from banquet_fixture), '侵入者', 'まちがい');
end;
$$;
select is(
  (select count(*) from private.join_attempts
   where user_id = '00000000-0000-0000-0000-000000000004'),
  5::bigint,
  'failed join attempts persist for throttling'
);
select is(
  public.join_banquet_room((select invite_code from banquet_fixture), '侵入者', '月夜のタルト'),
  null::uuid,
  'throttled identity cannot immediately retry the passphrase'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select isnt(
  public.join_banquet_room((select invite_code from banquet_fixture), 'あおい', '月夜のタルト'),
  null::uuid,
  'first guest joins with the spoken passphrase'
);
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
select isnt(
  public.join_banquet_room((select invite_code from banquet_fixture), 'れん', '月夜のタルト'),
  null::uuid,
  'second guest joins with the spoken passphrase'
);

select throws_ok(
  $$select public.start_banquet_room((select room_id from banquet_fixture))$$,
  'P0001',
  '幹事だけが開宴できます',
  'guest cannot start the feast'
);
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select lives_ok(
  $$select public.start_banquet_room((select room_id from banquet_fixture))$$,
  'host starts the feast'
);
select is(
  public.get_my_banquet_hand((select room_id from banquet_fixture)),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  'host opens only their available reservation cards after the feast starts'
);
update public.room_dishes
set points = 4, dish_id = 'dish-plus-4'
where room_id = (select room_id from banquet_fixture) and round_index = 0;

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select throws_ok(
  $$select public.reveal_banquet_round((select room_id from banquet_fixture))$$,
  'P0001',
  '幹事だけがクロッシュを開けられます',
  'guest cannot reveal the cloche'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
do $$ begin perform public.seal_banquet_bid((select room_id from banquet_fixture), 15, 0); end; $$;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
do $$ begin perform public.seal_banquet_bid((select room_id from banquet_fixture), 15, 0); end; $$;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
do $$ begin perform public.seal_banquet_bid((select room_id from banquet_fixture), 12, 0); end; $$;

set local role authenticated;
select is(
  (select count(*) from public.room_bids
   where room_id = (select room_id from banquet_fixture)),
  1::bigint,
  'guest sees only their own sealed reservation before reveal'
);
reset role;

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
select lives_ok(
  $$select public.reveal_banquet_round((select room_id from banquet_fixture))$$,
  'host reveals a complete round'
);
select is(
  (select outcome->>'winnerId'
   from public.room_round_results
   where room_id = (select room_id from banquet_fixture) and round_index = 0),
  (select id::text from public.room_members
   where room_id = (select room_id from banquet_fixture)
     and user_id = '00000000-0000-0000-0000-000000000003'),
  'matching high bids collide and the highest unique bid wins'
);
select is(
  (select score from public.room_members
   where room_id = (select room_id from banquet_fixture)
     and user_id = '00000000-0000-0000-0000-000000000003'),
  4,
  'revealed dish updates the winner score'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
set local role authenticated;
select is(
  (select count(*) from public.room_bids
   where room_id = (select room_id from banquet_fixture)),
  3::bigint,
  'all sealed reservations become visible after reveal'
);
reset role;

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
do $$ begin perform public.advance_banquet_round((select room_id from banquet_fixture)); end; $$;
select throws_ok(
  $$select public.seal_banquet_bid((select room_id from banquet_fixture), 14, 0)$$,
  'P0001',
  '画面を更新してください',
  'a stale dish screen cannot seal a reservation for the next dish'
);
select throws_ok(
  $$select public.seal_banquet_bid((select room_id from banquet_fixture), 15)$$,
  'P0001',
  'その予約札は封蝋済みです',
  'a host cannot reuse a sealed reservation card'
);

update public.rooms set expires_at = now() - interval '1 minute'
where id = (select room_id from banquet_fixture);
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
select is(
  public.join_banquet_room((select invite_code from banquet_fixture), '遅刻客', '月夜のタルト'),
  null::uuid,
  'expired invitation rejects late joins'
);

select * from finish();
rollback;
