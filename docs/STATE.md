# State

## Location and herd for each offer

Decided with the owner on 31 October 2026, after a spike comparing the full list, a file per province and Photon (artifact https://claude.ai/artifact/4ooUqahcxPBccF6fteqAkj). Record in ADR-0015 when done.
Work stays on branch `ccr-32fbee75-oc1p8v`; `master` is published only when the owner says so.

### Design

- Location: one search box over every populated place in Spain; picking a village fills in its municipality and province.
  - Data: GeoNames (CC BY 4.0, credited in «Leyes»), about 32,000 places with INE municipality codes, built into one versioned file (`data/places-<yyyy-mm>.json`, about 430 KB compressed) by a script in the repo (`npm run places`). IGN's gazetteer can replace it later: same municipality codes, no change to saved offers.
  - Loading: the file is fetched in the background when an offer's form opens, and kept in the browser's cache storage under its versioned name, so it is downloaded once per version. With data saving on or a 2G connection, it is fetched only when the location field is focused. Until it arrives the field says so and fills in when it lands; offline with no copy, it says the list could not be loaded and the offer stays editable.
  - Saved: `terms.municipality` (INE code) and `terms.province` (code), shared; `mine.place` (the village name), never shared. Typing without picking keeps the text in `mine.place` and leaves the codes empty.
- Herd: one head count per species in `terms` (`sheep`, `goats`, `cattle`), each optional.
- Shown: in the offer summary and the read-only view of another shepherd's offer (municipality, province and herd there; no village). No figures per head yet.
- `SCHEMA_VERSION` 2.

### Plan

1. The places file and its build script; the cache-storage loader with the preload rules. Unit tests for the search and the loader's choices.
2. The fields in the form, `terms`/`mine`, the summary and the shared view, `SCHEMA_VERSION` 2. Browser tests.
3. ADR-0015; `docs/model.md`, `AGENTS.md`, the credit in «Leyes»; screenshots; then delete this section and update the backlog item.
