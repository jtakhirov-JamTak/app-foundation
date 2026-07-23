begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'pgtap-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'pgtap-b@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select lives_ok(
  $$select * from public.create_example_record(
    'A record',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )$$,
  'User A can create their own example record'
);

select is(
  (select count(*)::integer from public.example_records),
  1,
  'User A initially sees one own record'
);

reset role;
insert into public.example_records (user_id, title, idempotency_key)
values (
  '22222222-2222-4222-8222-222222222222',
  'B record',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select count(*)::integer from public.example_records),
  1,
  'User A cannot read User B record'
);

select throws_ok(
  $$insert into public.example_records (user_id, title, idempotency_key)
    values (
      '22222222-2222-4222-8222-222222222222',
      'Cross-owner',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    )$$,
  '42501',
  null,
  'User A cannot create a User B record'
);

select throws_ok(
  $$update public.example_records
    set user_id = '22222222-2222-4222-8222-222222222222'
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  null,
  'User A cannot transfer their record to User B'
);

select lives_ok(
  $$select * from public.create_example_record(
    'A record',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )$$,
  'Idempotent retry succeeds'
);

select is(
  (select count(*)::integer from public.example_records where user_id =
    '11111111-1111-4111-8111-111111111111'),
  1,
  'Idempotent retry does not duplicate the record'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.example_records$$,
  '42501',
  null,
  'Anonymous users cannot read example records'
);

select throws_ok(
  $$select * from public.create_example_record(
    'Anonymous',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  )$$,
  '42501',
  null,
  'Anonymous users cannot execute the example create function'
);

reset role;

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'example_records'
      and (qual = 'true' or with_check = 'true')
  ),
  0,
  'No permissive true RLS policy exists on the example table'
);

select * from finish();
rollback;
