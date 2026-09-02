-- Cups and challenges (PL-24): a list is mandatory and guests may hand one
-- in, both by default. The create form and the pokedata importer now start
-- these two flags on whenever the category is cup or challenge
-- (requiresListByDefault in lib/event-category.ts); this flips the events
-- that already exist (8 rows on 2026-09-02, all open). Registrations made
-- before this without a list are untouched: list_required only gates new
-- registrations, and every existing registrant keeps their row.

update public.events
   set list_required = true,
       allow_guest_lists = true
 where category in ('cup', 'challenge');
