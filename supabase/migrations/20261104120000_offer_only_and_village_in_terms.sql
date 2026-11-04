-- Schema version 3 (ADR-0028): whether an offer was worked (`offerOnly`) and its village (`place`) are facts about the
-- offer, so they move from the private `offer_mine.mine` to the shared `offers.terms`. The page's `upgrade[2]` in
-- src/schema.js does the same for browser copies and backups.
-- `mine` wins over `terms` for offerOnly: it moved to `mine` on 30 October 2026 (ADR-0017), and version-2 rows written
-- before that may still hold a stale copy in `terms`.

update public.offers o
set terms = o.terms
      || jsonb_build_object(
        'offerOnly', coalesce(m.mine -> 'offerOnly', o.terms -> 'offerOnly', 'false'::jsonb),
        'place', coalesce(m.mine -> 'place', o.terms -> 'place', '""'::jsonb)
      ),
    schema_version = 3
from public.offer_mine m
where m.offer_id = o.id and o.schema_version < 3;

-- Offers with no `offer_mine` row
update public.offers
set terms = terms
      || jsonb_build_object(
        'offerOnly', coalesce(terms -> 'offerOnly', 'false'::jsonb),
        'place', coalesce(terms -> 'place', '""'::jsonb)
      ),
    schema_version = 3
where schema_version < 3;

update public.offer_mine set mine = mine - 'offerOnly' - 'place' where mine ?| array['offerOnly', 'place'];

-- Pages of version 1 would write both back into `mine` and leave `terms` without them: they stop writing.
update public.app_meta set min_page_version = 2 where min_page_version < 2;
