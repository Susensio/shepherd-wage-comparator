# kb/: knowledge base of territorial law figures

Decided in [ADR-0033](../docs/adr/0033-knowledge-base-for-law-figures.md). Public material only: the repository is published as it is.

## The chain

`originals → manifest → reports → tables → code`. One way. Each stage cites the previous one by id; nothing reaches `src/` without a manifest id and an article.

| Stage | Where | What it holds | Who writes it |
| --- | --- | --- | --- |
| originals | release assets (see TODO) and the official URLs | the PDFs, XML and CSV as published | a collector, never edited |
| manifest | `manifest.json` | one record per document: id, publisher, jurisdiction, type, authority, URLs, publication and in-force dates, retrieval date, sha256, storage, text, licence, supersession, status | research agent |
| text | `text/<id>.md` | plain-text extract with article headings, front matter `id`, `source_url`, `retrieved`, `extract` (says what was cut, if anything) | research agent, by script from the official XML, JSON or PDF |
| reports | `reports/<topic>/<territory>-<year>.md` | what a coding agent reads: «For the page», facts, what changes in the model, uncertainty, evidence | research agent, status `draft` until the owner verifies |
| tables | `tables/*.csv` | one fact per row, with source id, article, a verbatim quote and a status | research agent; `checked` is set only where the script finds the quote |
| code | `scripts/build-law-data.js`, which generates `src/law-territorial.js` from the verified rows | validates the tables; will generate the page's data (not yet) | main agent |

The main agent writes the ADRs, `docs/BACKLOG.md` and `docs/STATE.md`; the research agent writes only inside `kb/`.

## Ids and territories

- Document id: the official one where there is one (`BOE-A-2025-21667`), else `<publisher>-<year>-<number>-<slug>` (`BOA-2025-225-fiestas-locales-2026`).
- Territory: `es`, `ccaa:NN` (INE community code: 02 Aragón, 09 Cataluña…), `prov:NN` (INE province: 22 Huesca), `mun:NNNNN` (INE municipality, as in `data/places-*.json`).
- Document status: `candidate` (found or expected, not fetched), `current` (also a collective agreement that keeps applying by its own rules after its term), `superseded`, `owner-provided`. `supplements` is used instead of `corrected_by` where a later text adds to an earlier one without correcting it.

## Row status

`extracted` (read from the text, quote not yet matched) → `checked` (the script found the quote verbatim in `text/<source_id>.md`, and the other validations pass) → `verified` (the owner confirmed it; `verified_by` names them). Only `verified` rows may reach the page. An agent never sets `verified`.

## Review

No pull request. For each new or changed figure the main agent shows the owner a summary table in the session (figure, value, territory, source and article, short verbatim quote, link to the original). On the owner's word the row becomes `verified`.

## Tables

- `tables/holidays.csv`: `territory,year,date,name,scope,source_id,source_ref,quote,status,verified_by,note`; scope `national|regional|local|substitute`. Rule: 12 to 15 national and regional days per community and year, exactly two local days per listed municipality, no duplicate territory and date.
- `tables/agreement_terms.csv`: `territory,valid_from,valid_to,concept,value,unit,applies_to,source_id,source_ref,quote,status,verified_by,note`. Concepts and units are listed in `scripts/build-law-data.js` with their allowed ranges.
- A figure from the owner's private comparison table never goes into a table here: the table is only a pointer to the primary text, which is quoted instead.

## Checking

`npm run law-data -- --check` (also run by `npm test` through `test/unit/kb.test.js`) checks columns, enums, ISO dates, `source_id` in the manifest, non-empty `source_ref`, every quote verbatim in its text, ranges, holiday counts, and cross-checks the Aragón rows against the BOE annex and Aragón's open-data CSV. It prints a coverage list.

## Not done yet

- TODO: originals as release assets (`kb-2026`) once the owner creates the release; until then `storage` is `link-only` and the manifest holds each original's URL and sha256.
- TODO: a collector (GitHub Action) that fetches, hashes and extracts; until then the texts were extracted by hand-run scripts.
- TODO: the year-over-year diff in `build-law-data.js`; a separate data file per community once local holidays outgrow one module.
- TODO: Decreto 163/2026 (2027) and BOE-A-2026-21254 are in the manifest with their text; their rows are not in the tables yet.
