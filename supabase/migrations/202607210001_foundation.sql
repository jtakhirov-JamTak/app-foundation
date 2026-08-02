-- Required foundation schema: shared timestamp trigger and server-written analytics.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon;
grant execute on function public.set_updated_at() to authenticated, service_role;


-- Generic privacy invariant. It knows nothing about individual events: event
-- semantics live in src/lib/analytics/catalog.ts, which is the only place a new
-- event is declared. Mirrored in TypeScript by PROHIBITED_KEY in
-- src/lib/analytics/privacy.ts; change both together, and keep the shared
-- vectors in supabase/tests/001_foundation_rls.sql and privacy.test.ts in step.
--
-- The key policy is deliberate: EVERY *_name segment is rejected, technical
-- sounding keys like screen_name and error_name included. Enumerating the
-- acceptable name variants is an unwinnable blocklist (child_name, partner_name,
-- doctor_name, ...); a legitimate technical key gets renamed at catalog-design
-- time instead (screen, metric, code). Word boundaries rather than bare
-- substrings are what let subtitle, notes_count and hostname through.
--
-- The explicit case is not decoration: the function must be independently safe
-- on non-object input rather than relying on a caller's `and` short-circuit.
create or replace function public.analytics_properties_safe(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' then false
    else not exists (
      select 1 from jsonb_each(p) as e(key, value)
      where e.key ~* '^(username|nickname)$'
         or e.key ~* '(^|_)(name|email|phone|address|text|prompt|output|title|note|url|token|message|stack|filename|location|health|financial|relationship)(_|$)'
         or jsonb_typeof(e.value) not in ('string', 'number', 'boolean')
    )
  end;
$$;


create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  platform text not null,
  app_version text not null,
  constraint events_event_name_format check (event_name ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint events_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint events_properties_safe check (public.analytics_properties_safe(properties)),
  constraint events_properties_size check (octet_length(properties::text) <= 4096),
  constraint events_platform_allowlist check (platform in ('web', 'pwa', 'ios', 'android')),
  constraint events_app_version_length check (char_length(app_version) between 1 and 100)
);

comment on table public.events is
  'Thin additive interaction analytics. Domain tables remain the source of truth.';

create index events_user_occurred_idx on public.events (user_id, occurred_at desc);
create index events_name_occurred_idx on public.events (event_name, occurred_at desc);

-- RLS stays enabled with no policies: deny-all for client roles. Analytics are
-- written only by /api/events under the service role, after requireUser()
-- establishes the identity, so no client-supplied user_id can ever reach a row.
alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant select, insert, delete on public.events to service_role;
