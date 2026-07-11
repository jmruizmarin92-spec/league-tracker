-- Phase 11: ability to "end" (archive) a league. Active leagues have
-- archived_at = null. Archiving is done by league admins via the leagues
-- update RLS policy (no new RPC needed).
alter table public.leagues
  add column if not exists archived_at timestamptz;
