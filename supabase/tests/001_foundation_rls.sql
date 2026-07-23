begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'b@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select lives_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      'screen_viewed',
      '{"screen":"home"}',
      'web',
      'test'
    )$$,
  'User A can insert their own event'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values (
      '22222222-2222-4222-8222-222222222222',
      'screen_viewed',
      '{"screen":"home"}',
      'web',
      'test'
    )$$,
  '42501',
  null,
  'User A cannot insert an event for User B'
);

select throws_ok(
  $$select * from public.events$$,
  '42501',
  null,
  'Authenticated clients cannot read analytics events'
);

select throws_ok(
  $$update public.events
    set user_id = '22222222-2222-4222-8222-222222222222'$$,
  '42501',
  null,
  'Authenticated clients cannot update analytics events'
);

select throws_ok(
  $$delete from public.events$$,
  '42501',
  null,
  'Authenticated clients cannot delete analytics events'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      'invalid_event_name',
      '{}',
      'web',
      'test'
    )$$,
  '23514',
  null,
  'The database event-name allowlist rejects unknown events'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      'screen_viewed',
      jsonb_build_object('screen', 'home', 'padding', repeat('x', 5000)),
      'web',
      'test'
    )$$,
  '23514',
  null,
  'Oversized analytics properties are rejected'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      'screen_viewed',
      '{"email":"private@example.invalid"}',
      'web',
      'test'
    )$$,
  '23514',
  null,
  'Sensitive analytics property keys are rejected'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      'screen_viewed',
      '{"screen":"private_user_value"}',
      'web',
      'test'
    )$$,
  '23514',
  null,
  'Allowed analytics keys reject non-catalog values'
);

reset role;
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and (qual = 'true' or with_check = 'true')
  ),
  0,
  'No permissive true RLS policy exists on foundation tables'
);

select * from finish();
rollback;
