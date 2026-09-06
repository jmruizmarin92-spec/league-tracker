-- PL-31: first migration applied by the db-migrate workflow instead of by
-- hand. Exposes the applied migration versions (read-only) so the Vercel
-- Ignored Build Step (scripts/vercel-ignore-build.mjs) can refuse to build a
-- commit whose migrations have not reached this database yet.
--
-- The CLI keeps its history in supabase_migrations.schema_migrations, a
-- schema the REST API does not expose, hence the security definer wrapper.
-- The only thing it leaks is the list of version prefixes, which is the same
-- list anyone can read in the public repo. plpgsql on purpose: a `language
-- sql` body is validated at creation and would fail while the history table
-- does not exist yet (the baseline creates it).

create or replace function public.migration_versions()
returns text[]
language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce(
    (select array_agg(version order by version) from supabase_migrations.schema_migrations),
    '{}'::text[]
  );
exception
  when undefined_table or invalid_schema_name then
    return '{}'::text[];
end $$;

revoke all on function public.migration_versions() from public;
grant execute on function public.migration_versions() to anon, authenticated;
