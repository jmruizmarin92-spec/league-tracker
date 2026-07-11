-- Leagues gain a free-text prizes field, shown under the point formula on
-- the standings page, mirroring events.prizes.
alter table public.leagues add column if not exists prizes text;
