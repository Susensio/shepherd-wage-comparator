-- Schema version 8 (ADR-0035): `mine.record.paid` (`asAgreed` | `none`; absent: unknown) replaces `nothingPaid`. The other
-- new fields (a month's `count` of days instead of per-day marks, a cobro marked `approx`) are optional and need no rewrite.
-- The page's `upgrade[7]` in src/schema.js does the same for browser copies and backups.

update public.offer_mine
set mine = jsonb_set(mine, '{record,paid}', '"none"'::jsonb)
where mine #> '{record,nothingPaid}' = 'true'::jsonb;

update public.offer_mine
set mine = mine #- '{record,nothingPaid}'
where (mine -> 'record') ? 'nothingPaid';

update public.offers set schema_version = 8 where schema_version < 8;

-- A page of version 6 holding an offer in memory (an unsynced edit) would write `nothingPaid` back, or reopen what the
-- new fields say, without a word: pages below 7 stop writing.
update public.app_meta set min_page_version = 7 where min_page_version < 7;
