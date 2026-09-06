-- One-time baseline for the db-migrate pipeline (PL-31). Paste this ONCE in
-- the Supabase SQL editor of the production project before the first run of
-- the GitHub workflow. It records migrations 0001–0052 as already applied in
-- the Supabase CLI history table, so `supabase db push` starts from 0053 and
-- never re-runs the hand-applied files. Safe to paste twice.
--
-- Equivalent CLI form, if you prefer it and have the DB password at hand:
--   npx supabase migration repair --db-url "<session pooler url>" --status applied 0001 0002 ... 0052

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;

insert into supabase_migrations.schema_migrations (version, name) values
  ('0001', 'auth_profiles'),
  ('0002', 'grants'),
  ('0003', 'players'),
  ('0004', 'player_profile_fields'),
  ('0005', 'leagues'),
  ('0006', 'sessions'),
  ('0007', 'session_refinements'),
  ('0008', 'archetypes'),
  ('0009', 'rounds'),
  ('0010', 'events'),
  ('0011', 'league_archive'),
  ('0012', 'archetype_visibility'),
  ('0013', 'realtime_display'),
  ('0014', 'deletions'),
  ('0015', 'league_duration'),
  ('0016', 'categories'),
  ('0017', 'league_format'),
  ('0018', 'event_subtitle'),
  ('0019', 'league_defaults'),
  ('0020', 'remove_session_category'),
  ('0021', 'league_subtitle'),
  ('0022', 'update_session'),
  ('0023', 'prerelease_category'),
  ('0024', 'event_staff'),
  ('0025', 'league_weekly_schedule'),
  ('0026', 'league_prizes'),
  ('0027', 'late_participants'),
  ('0028', 'late_participant_bye'),
  ('0029', 'merge_players_fix'),
  ('0030', 'match_tables'),
  ('0031', 'session_slugs'),
  ('0032', 'round_timer'),
  ('0033', 'session_format'),
  ('0034', 'lock_archetypes'),
  ('0035', 'join_setup_only'),
  ('0036', 'event_archetypes'),
  ('0037', 'checked_in'),
  ('0038', 'league_prize_awards'),
  ('0039', 'event_entry_deadline'),
  ('0040', 'event_checked_in'),
  ('0041', 'event_tdf'),
  ('0042', 'round_status_repair'),
  ('0043', 'player_decks'),
  ('0044', 'event_play_import'),
  ('0045', 'stores'),
  ('0046', 'store_admins'),
  ('0047', 'generate_sessions_slug'),
  ('0048', 'event_guest_lists'),
  ('0049', 'event_staff_lists'),
  ('0050', 'cup_challenge_list_defaults'),
  ('0051', 'guest_submit_token_fix'),
  ('0052', 'event_prize_budgets')
on conflict (version) do nothing;
