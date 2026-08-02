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
