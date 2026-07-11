-- Leagues gain the same short free-text subtitle as events (quick info,
-- shown alongside the game/format badges). No RPC changes needed — name,
-- subtitle, game, and format are all edited via a direct table update,
-- already permitted by the existing leagues UPDATE policy/grant for admins.
alter table public.leagues
  add column if not exists subtitle text;
