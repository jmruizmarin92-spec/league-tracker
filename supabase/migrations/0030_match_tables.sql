-- Table (seating) numbers for matches.
--
-- Goals:
--   1. Every two-player match gets a stable table number when the round is
--      created, so the pairings list has a fixed order that does NOT change as
--      results come in (previously reads had no ORDER BY, so an UPDATE could
--      shuffle the display order).
--   2. Byes / losses (player2_id null) get no table and always sort last.
--
-- table_number is per-round: matches within a round are numbered 1..N in
-- pairing order. Reads order by table_number with nulls last.

alter table public.matches add column if not exists table_number integer;

-- Backfill existing rounds: number the two-player matches in creation order,
-- leave byes/losses null.
with numbered as (
  select id,
         row_number() over (partition by round_id order by created_at, id) as rn
  from public.matches
  where player2_id is not null
)
update public.matches m
   set table_number = n.rn
  from numbered n
 where n.id = m.id
   and m.table_number is null;

-- Recreate create_round so it assigns table numbers. Byes are inserted with a
-- null table_number (they sort last); two-player matches get an incrementing
-- counter following the pairing order (best-standing pairs first).
create or replace function public.create_round(p_session uuid, p_pairings jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_round uuid; v_num int; v_pair jsonb; v_table int := 0;
begin
  if not public.is_league_admin(public.session_league(p_session)) then
    raise exception 'Not allowed';
  end if;
  if exists (
    select 1 from public.matches where session_id = p_session and result = 'pending'
  ) then
    raise exception 'Hay partidas sin resultado en la ronda actual';
  end if;

  select coalesce(max(number), 0) + 1 into v_num
  from public.rounds where session_id = p_session;

  insert into public.rounds (session_id, number)
  values (p_session, v_num) returning id into v_round;

  for v_pair in select * from jsonb_array_elements(p_pairings) loop
    if v_pair->>'player2' is null then
      insert into public.matches
        (round_id, session_id, player1_id, player2_id, result, reported_at, table_number)
      values
        (v_round, p_session, (v_pair->>'player1')::uuid, null, 'bye', now(), null);
    else
      v_table := v_table + 1;
      insert into public.matches
        (round_id, session_id, player1_id, player2_id, table_number)
      values
        (v_round, p_session, (v_pair->>'player1')::uuid, (v_pair->>'player2')::uuid, v_table);
    end if;
  end loop;

  update public.sessions set status = 'active'
  where id = p_session and status = 'setup';

  return v_round;
end; $$;

grant execute on function public.create_round(uuid, jsonb) to authenticated;
