-- Schema version 7: «Cerrar el registro» (mine.record.complete = { "date": "YYYY-MM-DD" }), said by the shepherd when every
-- cobro is recorded; it makes the figures of a finished job firm. The field is optional and needs no rewrite: only the
-- stamp moves. The page's `upgrade[6]` in src/schema.js is the identity for browser copies and backups.

update public.offers set schema_version = 7 where schema_version < 7;

-- A page of version 5 holding an offer in memory (an unsynced edit) would write `mine` back without `complete` and
-- reopen a closed record without a word: pages below 6 stop writing.
update public.app_meta set min_page_version = 6 where min_page_version < 6;
