begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'pgtap-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'pgtap-b@example.invalid');

-- Client roles have no write path to public.events at all: the insert grant is
-- revoked and RLS is enabled with no policies. Analytics are written only by
-- /api/events under the service role, after requireUser() establishes identity.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      'screen_viewed',
      '{"screen":"home"}',
      'web',
      'test'
    )$$,
  '42501',
  null,
  'Authenticated clients cannot insert an event, even for themselves'
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
  'Authenticated clients cannot insert an event for another user'
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

-- Everything below runs as the role that actually writes events, so it exercises
-- the CHECK constraints rather than the grant.
reset role;
set local role service_role;

-- The reject vectors are the same list as REJECTED_KEYS in
-- src/lib/analytics/privacy.test.ts. screen_name is rejected on purpose: every
-- *_name segment is, because enumerating the acceptable ones is an unwinnable
-- blocklist. A technical key gets renamed at catalog-design time instead.
select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values ('11111111-1111-4111-8111-111111111111', 'privacy_probe',
      '{"screen_name":"home"}', 'web', 'test')$$,
  '23514',
  null,
  'Property key screen_name is rejected'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values ('11111111-1111-4111-8111-111111111111', 'privacy_probe',
      '{"patient_name":"value"}', 'web', 'test')$$,
  '23514',
  null,
  'Property key patient_name is rejected'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values ('11111111-1111-4111-8111-111111111111', 'privacy_probe',
      '{"full_name":"value"}', 'web', 'test')$$,
  '23514',
  null,
  'Property key full_name is rejected'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values ('11111111-1111-4111-8111-111111111111', 'privacy_probe',
      '{"email":"private@example.invalid"}', 'web', 'test')$$,
  '23514',
  null,
  'Property key email is rejected'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values ('11111111-1111-4111-8111-111111111111', 'privacy_probe',
      '{"user_email":"private@example.invalid"}', 'web', 'test')$$,
  '23514',
  null,
  'Property key user_email is rejected'
);

select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values ('11111111-1111-4111-8111-111111111111', 'privacy_probe',
      '{"access_token":"value"}', 'web', 'test')$$,
  '23514',
  null,
  'Property key access_token is rejected'
);

-- The accept vectors, same list as ACCEPTED_KEYS in privacy.test.ts. subtitle
-- and notes_count are what word-boundary matching buys over bare substrings.
select lives_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      'privacy_probe',
      '{"metric":"LCP","digest":"abc","screen":"home","feedback_ms":12,
        "subtitle":"ok","notes_count":3}',
      'web',
      'test'
    )$$,
  'Keys that only embed a sensitive word are accepted'
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
    values ('11111111-1111-4111-8111-111111111111', 'Not A Valid Name',
      '{"screen":"home"}', 'web', 'test')$$,
  '23514',
  null,
  'Malformed event names are rejected'
);

-- analytics_properties_safe has to be safe on its own for non-object input,
-- not merely as the second half of an `and`.
select throws_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values ('11111111-1111-4111-8111-111111111111', 'screen_viewed',
      '"not an object"'::jsonb, 'web', 'test')$$,
  '23514',
  null,
  'Non-object properties are rejected'
);

-- One valid instance of every foundation event in src/lib/analytics/catalog.ts.
-- This is the guard against privacy-regex false positives: a key policy change
-- that rejects a legitimate event fails db:test here instead of failing silently
-- in production. Add a row whenever the catalog gains an event. Events a feature
-- adds are covered by that feature's own _tests/*.sql, which is deleted with it.
select lives_ok(
  $$insert into public.events (user_id, event_name, properties, platform, app_version)
    values
      ('11111111-1111-4111-8111-111111111111', 'screen_viewed',
        '{"screen":"home","referrer_screen":"settings"}', 'web', 'test'),
      ('11111111-1111-4111-8111-111111111111', 'navigation_feedback_measured',
        '{"from":"home","to":"settings","feedback_ms":120}', 'web', 'test'),
      ('11111111-1111-4111-8111-111111111111', 'web_vital_recorded',
        '{"metric":"LCP","value":1234.5,"rating":"good","navigation_type":"navigate","screen":"home"}',
        'web', 'test'),
      ('11111111-1111-4111-8111-111111111111', 'app_error_recorded',
        '{"area":"global","code":"ROUTE_RENDER_FAILED","recoverable":true}', 'web', 'test')$$,
  'Every catalogued event is accepted by the generic database constraints'
);

reset role;

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
  ),
  0,
  'public.events has no RLS policies, so client roles are denied by default'
);

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
