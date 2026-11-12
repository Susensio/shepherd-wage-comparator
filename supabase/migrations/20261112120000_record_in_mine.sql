-- Schema version 5 (ADR-0032): `mine.record`, what happened in a job (days by month, payments received), private to the
-- account. Every row gets an empty one; the page's `upgrade[4]` in src/schema.js does the same for browser copies and
-- backups.

update public.offer_mine
set mine = mine || jsonb_build_object('record', coalesce(mine -> 'record', '{"months": {}, "payments": []}'::jsonb))
where not (mine ? 'record');

update public.offers set schema_version = 5 where schema_version < 5;

-- A page of version 3 holding an offer in memory (an unsynced edit) would write `mine` back without the record and
-- erase what the shepherd recorded since: pages below 4 stop writing.
update public.app_meta set min_page_version = 4 where min_page_version < 4;
