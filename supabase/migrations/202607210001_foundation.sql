-- Required foundation schema: shared timestamp trigger and insert-only analytics.

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


create or replace function public.analytics_event_valid(
  p_event_name text,
  p_properties jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_properties) <> 'object' then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_each(p_properties) as entry(key, value)
    where entry.key ~* '(name|email|phone|address|text|prompt|output|title|note|url|token|message|stack|filename|location|health|financial|relationship)'
      or jsonb_typeof(entry.value) not in ('string', 'number', 'boolean')
  ) then
    return false;
  end if;

  case p_event_name
    when 'screen_viewed' then
      return p_properties ? 'screen'
        and (p_properties - 'screen' - 'referrer_screen') = '{}'::jsonb
        and jsonb_typeof(p_properties -> 'screen') = 'string'
        and p_properties ->> 'screen' in ('home', 'settings')
        and (
          not (p_properties ? 'referrer_screen')
          or (
            jsonb_typeof(p_properties -> 'referrer_screen') = 'string'
            and p_properties ->> 'referrer_screen' in ('home', 'settings')
          )
        );

    when 'navigation_feedback_measured' then
      return p_properties ?& array['from', 'to', 'feedback_ms']
        and (p_properties - 'from' - 'to' - 'feedback_ms') = '{}'::jsonb
        and jsonb_typeof(p_properties -> 'from') = 'string'
        and jsonb_typeof(p_properties -> 'to') = 'string'
        and jsonb_typeof(p_properties -> 'feedback_ms') = 'number'
        and p_properties ->> 'from' in ('home', 'settings')
        and p_properties ->> 'to' in ('home', 'settings')
        and p_properties -> 'feedback_ms' >= '0'::jsonb
        and p_properties -> 'feedback_ms' <= '60000'::jsonb;

    when 'web_vital_recorded' then
      return p_properties ?& array['metric', 'value', 'rating', 'navigation_type', 'screen']
        and (p_properties - 'metric' - 'value' - 'rating' - 'navigation_type' - 'screen') = '{}'::jsonb
        and jsonb_typeof(p_properties -> 'metric') = 'string'
        and jsonb_typeof(p_properties -> 'value') = 'number'
        and jsonb_typeof(p_properties -> 'rating') = 'string'
        and jsonb_typeof(p_properties -> 'navigation_type') = 'string'
        and jsonb_typeof(p_properties -> 'screen') = 'string'
        and p_properties ->> 'metric' in ('LCP', 'INP', 'CLS')
        and p_properties ->> 'rating' in ('good', 'needs-improvement', 'poor')
        and p_properties ->> 'navigation_type' in ('navigate', 'reload', 'back-forward', 'prerender')
        and p_properties ->> 'screen' in ('home', 'settings')
        and p_properties -> 'value' >= '0'::jsonb
        and p_properties -> 'value' <= '1000000000'::jsonb;

    when 'app_error_recorded' then
      return p_properties ?& array['area', 'code', 'recoverable']
        and (p_properties - 'area' - 'code' - 'recoverable') = '{}'::jsonb
        and jsonb_typeof(p_properties -> 'area') = 'string'
        and jsonb_typeof(p_properties -> 'code') = 'string'
        and jsonb_typeof(p_properties -> 'recoverable') = 'boolean'
        and p_properties ->> 'area' in ('global', 'protected_route', 'analytics')
        and p_properties ->> 'code' in (
          'UNHANDLED_APPLICATION_ERROR',
          'ROUTE_RENDER_FAILED',
          'ANALYTICS_WRITE_FAILED'
        );

    else
      return false;
  end case;
end;
$$;

revoke all on function public.analytics_event_valid(text, jsonb) from public, anon;
grant execute on function public.analytics_event_valid(text, jsonb) to authenticated, service_role;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  platform text not null,
  app_version text not null,
  constraint events_event_name_allowlist check (
    event_name in (
      'screen_viewed',
      'navigation_feedback_measured',
      'web_vital_recorded',
      'app_error_recorded'
    )
  ),
  constraint events_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint events_properties_privacy check (public.analytics_event_valid(event_name, properties)),
  constraint events_properties_size check (octet_length(properties::text) <= 4096),
  constraint events_platform_allowlist check (platform in ('web', 'pwa', 'ios', 'android')),
  constraint events_app_version_length check (char_length(app_version) between 1 and 100)
);

comment on table public.events is
  'Thin additive interaction analytics. Domain tables remain the source of truth.';

create index events_user_occurred_idx on public.events (user_id, occurred_at desc);
create index events_name_occurred_idx on public.events (event_name, occurred_at desc);

alter table public.events enable row level security;

create policy events_insert_own
on public.events
for insert
to authenticated
with check (auth.uid() = user_id);

revoke all on public.events from anon, authenticated;
grant insert on public.events to authenticated;
grant select, insert, delete on public.events to service_role;
