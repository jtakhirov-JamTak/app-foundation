-- EXAMPLE-ONLY MIGRATION.
-- Delete this file together with src/app/(app)/(example-feature) to remove the example.

create table public.example_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint example_records_title_length check (char_length(title) between 1 and 120),
  constraint example_records_user_id_id_key unique (user_id, id),
  constraint example_records_user_id_idempotency_key unique (user_id, idempotency_key)
);

create trigger example_records_set_updated_at
before update on public.example_records
for each row execute function public.set_updated_at();

create index example_records_user_created_idx
  on public.example_records (user_id, created_at desc);

create index example_records_user_active_idx
  on public.example_records (user_id, created_at desc)
  where archived_at is null;

alter table public.example_records enable row level security;

create policy example_records_select_own
on public.example_records
for select
to authenticated
using (auth.uid() = user_id);

create policy example_records_insert_own
on public.example_records
for insert
to authenticated
with check (auth.uid() = user_id);

create policy example_records_update_own
on public.example_records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.example_records from anon, authenticated;
grant select, insert, update on public.example_records to authenticated;
grant select, insert, update, delete on public.example_records to service_role;

create or replace function public.create_example_record(
  p_title text,
  p_idempotency_key uuid
)
returns setof public.example_records
language sql
security invoker
set search_path = ''
as $$
  with inserted as (
    insert into public.example_records (user_id, title, idempotency_key)
    values (auth.uid(), p_title, p_idempotency_key)
    on conflict (user_id, idempotency_key) do nothing
    returning *
  )
  select * from inserted
  union all
  select *
  from public.example_records
  where user_id = auth.uid()
    and idempotency_key = p_idempotency_key
  limit 1;
$$;

revoke all on function public.create_example_record(text, uuid) from public, anon;
grant execute on function public.create_example_record(text, uuid) to authenticated;

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
        and p_properties ->> 'screen' in ('home', 'settings', 'example')
        and (
          not (p_properties ? 'referrer_screen')
          or (
            jsonb_typeof(p_properties -> 'referrer_screen') = 'string'
            and p_properties ->> 'referrer_screen' in ('home', 'settings', 'example')
          )
        );

    when 'navigation_feedback_measured' then
      return p_properties ?& array['from', 'to', 'feedback_ms']
        and (p_properties - 'from' - 'to' - 'feedback_ms') = '{}'::jsonb
        and jsonb_typeof(p_properties -> 'from') = 'string'
        and jsonb_typeof(p_properties -> 'to') = 'string'
        and jsonb_typeof(p_properties -> 'feedback_ms') = 'number'
        and p_properties ->> 'from' in ('home', 'settings', 'example')
        and p_properties ->> 'to' in ('home', 'settings', 'example')
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
        and p_properties ->> 'screen' in ('home', 'settings', 'example')
        and p_properties -> 'value' >= '0'::jsonb
        and p_properties -> 'value' <= '1000000000'::jsonb;

    when 'app_error_recorded' then
      return p_properties ?& array['area', 'code', 'recoverable']
        and (p_properties - 'area' - 'code' - 'recoverable') = '{}'::jsonb
        and jsonb_typeof(p_properties -> 'area') = 'string'
        and jsonb_typeof(p_properties -> 'code') = 'string'
        and jsonb_typeof(p_properties -> 'recoverable') = 'boolean'
        and p_properties ->> 'area' in ('global', 'protected_route', 'analytics', 'example')
        and p_properties ->> 'code' in (
          'UNHANDLED_APPLICATION_ERROR',
          'ROUTE_RENDER_FAILED',
          'ANALYTICS_WRITE_FAILED',
          'EXAMPLE_LOAD_FAILED',
          'EXAMPLE_SAVE_FAILED'
        );

    when 'example_record_created' then
      return p_properties = '{"source":"example_form"}'::jsonb;

    else
      return false;
  end case;
end;
$$;

revoke all on function public.analytics_event_valid(text, jsonb) from public, anon;
grant execute on function public.analytics_event_valid(text, jsonb) to authenticated, service_role;

alter table public.events drop constraint events_event_name_allowlist;
alter table public.events add constraint events_event_name_allowlist check (
  event_name in (
    'screen_viewed',
    'navigation_feedback_measured',
    'web_vital_recorded',
    'app_error_recorded',
    'example_record_created'
  )
);
