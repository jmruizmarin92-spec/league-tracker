-- PL-25: guest list submission fails on prod with
--   function gen_random_bytes(integer) does not exist (42883)
--
-- The guest_submit_event_list that is live on Supabase is an earlier draft
-- of 0048 that derived the edit token from pgcrypto's gen_random_bytes(). On
-- Supabase pgcrypto lives in the `extensions` schema, and the function runs
-- with `set search_path = public`, so the call cannot be resolved and every
-- submission (TCG and VGC alike) fails after the guards, rolling back the
-- registration. The committed 0048 already generates the token from two
-- gen_random_uuid() calls (core Postgres, no extension), but that body never
-- reached the database. This migration re-applies it verbatim.
--
-- Nothing else changes: same signature, same grants, same behaviour. The
-- other guest RPCs (guest_token_hash / guest_get_event_entry /
-- guest_update_event_list) work on prod and are left alone.

-- Hand in a list as a guest. Returns the edit token (shown once, kept by the
-- caller in a cookie / link).
create or replace function public.guest_submit_event_list(
  p_event uuid, p_name text, p_pokemon_id text, p_content text, p_url text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_event record;
  v_name text;
  v_pid text;
  v_player uuid;
  v_player_user uuid;
  v_has_list boolean;
  v_count int;
  v_status text;
  v_token text;
begin
  select * into v_event from public.events where id = p_event;
  if not found then raise exception 'Unknown event'; end if;
  if not v_event.allow_guest_lists then
    raise exception 'Guest lists are not enabled for this event';
  end if;
  if v_event.status <> 'open' then raise exception 'Registration is closed'; end if;
  if public.event_entry_locked(p_event) then
    raise exception 'The entry deadline has passed';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null then raise exception 'Name required'; end if;
  v_pid := regexp_replace(coalesce(p_pokemon_id, ''), '\s', '', 'g');
  if v_pid !~ '^[0-9]{1,10}$' then raise exception 'Invalid Pokémon ID'; end if;

  v_has_list := coalesce(trim(coalesce(p_content, '')), '') <> ''
             or coalesce(trim(coalesce(p_url, '')), '') <> '';
  if not v_has_list then raise exception 'A list is required'; end if;

  -- One person per Pokémon ID. Oldest row wins if the ID was ever duplicated.
  select id, user_id into v_player, v_player_user
    from public.players where pokemon_id = v_pid
    order by created_at asc limit 1;
  if v_player is not null then
    if v_player_user is not null then
      raise exception 'This Pokémon ID belongs to a registered user';
    end if;
    if exists (
      select 1 from public.event_registrations
      where event_id = p_event and player_id = v_player
    ) then
      raise exception 'This Pokémon ID is already registered for this event';
    end if;
  else
    insert into public.players (display_name, pokemon_id)
    values (v_name, v_pid)
    returning id into v_player;
  end if;

  if v_event.capacity is null then
    v_status := 'registered';
  else
    select count(*) into v_count from public.event_registrations
      where event_id = p_event and status = 'registered';
    v_status := case when v_count < v_event.capacity then 'registered' else 'waitlisted' end;
  end if;

  insert into public.event_registrations (event_id, player_id, status, has_list)
  values (p_event, v_player, v_status, true);

  insert into public.event_lists (event_id, player_id, content, url)
  values (p_event, v_player, nullif(trim(coalesce(p_content, '')), ''),
          nullif(trim(coalesce(p_url, '')), ''))
  on conflict (event_id, player_id)
  do update set content = excluded.content, url = excluded.url, submitted_at = now();

  -- Two v4 UUIDs = 64 hex chars / ~244 random bits, core Postgres only (no
  -- pgcrypto dependency under this search_path).
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.event_guest_entries (event_id, player_id, token_hash)
  values (p_event, v_player, public.guest_token_hash(v_token))
  on conflict (event_id, player_id)
  do update set token_hash = excluded.token_hash, created_at = now();

  return v_token;
end; $$;

grant execute on function public.guest_submit_event_list(uuid, text, text, text, text)
  to anon, authenticated;
