-- Schema version 9: `mine.record.expecting` (`{ "by": "YYYY-MM-DD" }`, the date optional), the shepherd's answer that a cobro
-- is still expected after the job ended, the counterpart of `complete`. The field is optional and needs no rewrite: only
-- the stamp moves. The page's `upgrade[8]` in src/schema.js is the identity for browser copies and backups.

update public.offers set schema_version = 9 where schema_version < 9;

-- A page of version 7 holding an offer in memory (an unsynced edit) would write `mine` back without `expecting` and lose
-- the answer without a word: pages below 8 stop writing.
update public.app_meta set min_page_version = 8 where min_page_version < 8;
