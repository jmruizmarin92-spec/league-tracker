-- Grant table privileges to the PostgREST API roles.
-- Table-level GRANTs are checked before RLS, so without these the anon/
-- authenticated roles get "permission denied" even when an RLS policy allows
-- the row. RLS still does the actual per-row gating.
--
-- admin_allowlist is intentionally NOT granted: it is read only by the
-- SECURITY DEFINER trigger (handle_new_user), never by API roles.

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
