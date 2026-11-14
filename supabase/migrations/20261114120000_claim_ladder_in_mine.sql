-- Schema version 6 (ADR-0034): how and when a job ended, the parties, when each month was closed, dated notes, a flag for
-- «no se cobró nada» (all inside `mine.record`, optional) and the claim steps done (`mine.claim`), private to the account.
-- The record's new fields are optional and need no rewrite; every `mine` gets the two new objects, empty. The page's
-- `upgrade[5]` in src/schema.js does the same for browser copies and backups.

update public.offer_mine
set mine = mine
  || jsonb_build_object('parties', coalesce(mine -> 'parties', '{"employerName": ""}'::jsonb))
  || jsonb_build_object('claim', coalesce(mine -> 'claim', '{"steps": {}}'::jsonb))
where not (mine ? 'parties') or not (mine ? 'claim');

update public.offers set schema_version = 6 where schema_version < 6;

-- A page of version 4 holding an offer in memory (an unsynced edit) would write `mine` back without the new fields and
-- erase what the shepherd noted since: pages below 5 stop writing.
update public.app_meta set min_page_version = 5 where min_page_version < 5;
