# Backup and restore runbook

How a derived app on Supabase gets its data back. Read this before launch, not during an
incident. Every app that serves real users executes one restore drill and records the
result before launch — that recorded result is a LAUNCH BLOCKERS line in `/deploy-check`.

## What your plan gives you, and what it does not

Automated daily backups cover **Pro, Team, and Enterprise projects only** — retention is
7 days on Pro, 14 on Team, and up to 30 on Enterprise. Point-in-time recovery is a paid
add-on on those same plans, not something any plan has by default. Where these exist they
live in the dashboard under **Database → Backups**, and a dashboard restore makes the
project inaccessible while it runs.

**Free-tier projects have no automated backups at all.** Supabase's own guidance for them
is to export regularly with the CLI and keep the copies off-site. That is why the drill
below must prove the **CLI dump-and-restore path specifically**: it is the only path every
plan has, and it is the only one available to a project that has not started paying.

## Dump

Three files, in this order — roles, then schema, then data. `$SRC` is the source
project's Postgres connection string (percent-encoded).

```bash
npx supabase db dump --db-url "$SRC" -f roles.sql --role-only
npx supabase db dump --db-url "$SRC" -f schema.sql
npx supabase db dump --db-url "$SRC" -f data.sql --use-copy --data-only
```

`--use-copy` emits `COPY` rather than one `INSERT` per row, which is what makes a restore
of any real table size finish. If the data dump errors on storage vector tables, exclude
them: `-x "storage.buckets_vectors" -x "storage.vector_indexes"`.

Store the three files off-site. They contain every row in the database, so they inherit
the data classification of the most sensitive table in it — treat them accordingly and
never commit them.

## Restore into a fresh project

Create the destination project first, and enable any non-default extensions and database
webhooks on it **before** loading, so the schema does not fail against a missing
extension. `$DEST` is the new project's connection string.

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$DEST"
```

`ON_ERROR_STOP=1` with `--single-transaction` is the point of the command: a partial
restore that reports success is worse than a failed one. `session_replication_role =
replica` suppresses triggers during the data load.

Afterwards: re-enable publications if the source used Realtime replication, and set
passwords by hand for any custom role with `LOGIN` — dumps and daily backups do not carry
them.

## Verify the restore

A restore is not done when psql exits 0. It is done when these three agree.

1. **Row counts, exactly.** `select count(*) from public.<table>;` on source and
   destination for each table. `pg_stat_user_tables.n_live_tup` is an estimate and is not
   acceptable as the drill's evidence.
2. **RLS is still on.** Policies travel inside `schema.sql`, so they normally survive —
   but a restore landing with row security off is the failure mode worth the check, and
   it is silent. Compare both queries against the source:

   ```sql
   select tablename, rowsecurity from pg_tables
   where schemaname = 'public' order by tablename;

   select tablename, policyname, cmd from pg_policies
   where schemaname = 'public' order by tablename, policyname;
   ```

   Every client-reachable table must show `rowsecurity = true` and the same policy set as
   the source.

3. **One real cross-user read.** Sign in as two test accounts and confirm the second
   cannot read the first's rows through the app. `npm run db:test` does not substitute for
   this here: it runs `supabase test db`, which targets the local stack, and the pgTAP
   suite in `supabase/tests/` needs the `pgtap` extension enabled on whatever database it
   runs against. Point it at the restored project only if you have enabled `pgtap` there.

## The drill

Once per app, before launch, into a throwaway destination project. Record in the app's own
deploy notes:

- date, source project ref, destination project ref
- dump file sizes and where the copies are stored
- per-table row counts, source vs destination
- the RLS check result and the cross-user read result
- total wall-clock time from dump to verified restore

That written record is what gets affirmed in `/deploy-check` — reading this file is not
the same as having run it, and only the recorded result counts.
