begin;

select plan(17);

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
  $$select 1 from pg_class where relname = 'room_bids_member_card_key'$$,
  'a reservation card can be sealed only once per feast'
);
select isnt_empty(
  $$select 1 from pg_class c where c.relname = 'rooms' and c.relrowsecurity$$,
  'rooms enable RLS'
);
select isnt_empty(
  $$select 1 from pg_class c where c.relname = 'room_bids' and c.relrowsecurity$$,
  'bids enable RLS'
);
select is_empty(
  $$select 1 from information_schema.role_table_grants
      where table_schema = 'private' and grantee = 'authenticated'$$,
  'authenticated callers have no direct private table access'
);
select has_function('private', 'is_room_member', array['uuid'], 'membership helper exists');
select has_function(
  'private',
  'is_round_revealed',
  array['uuid', 'integer'],
  'round reveal helper exists'
);
select isnt_empty(
  $$select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'rooms'$$,
  'room revisions are broadcast through Supabase Realtime'
);

select * from finish();
rollback;
