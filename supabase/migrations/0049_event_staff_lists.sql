-- Event staff (judges, scorekeepers…) need the submitted lists to run deck
-- checks, but until now event_lists was readable only by the submitter and
-- event admins. Staff are players rows (0024); a staff member counts here only
-- when their player row is linked to the logged-in user — managed players
-- without an account never reach this policy anyway.

create or replace function public.is_event_staff(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.event_staff s
    join public.players p on p.id = s.player_id
    where s.event_id = p_event and p.user_id = auth.uid()
  );
$$;
grant execute on function public.is_event_staff(uuid) to anon, authenticated;

drop policy if exists "event_lists_select_own_or_admin" on public.event_lists;
create policy "event_lists_select_own_admin_or_staff" on public.event_lists
  for select using (
    public.is_event_admin(event_id)
    or public.is_event_staff(event_id)
    or exists (
      select 1 from public.players p
      where p.id = event_lists.player_id and p.user_id = auth.uid()
    )
  );
