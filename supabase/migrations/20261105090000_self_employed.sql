-- Schema version 4 (ADR-0029): the self-employed contract (`terms.contract = 'selfEmployed'`) and `terms.vatIncluded`.
-- No offer changes shape; every row gets the new field at its default and the new version, and pages of version 2,
-- which do not know the contract, stop writing.

update public.offers
set terms = terms || jsonb_build_object('vatIncluded', coalesce(terms -> 'vatIncluded', 'false'::jsonb)),
    schema_version = 4
where schema_version < 4;

update public.app_meta set min_page_version = 3 where min_page_version < 3;
