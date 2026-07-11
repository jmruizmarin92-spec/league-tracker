-- New leagues default to 3 points per win, 1 per draw (matches typical
-- TCG/VGC league scoring). create_league doesn't set these explicitly, so it
-- relies on the column defaults. Existing leagues are untouched.
alter table public.leagues alter column win_value set default 3;
alter table public.leagues alter column draw_value set default 1;
