# ADR-0033: Keep territorial law figures in a knowledge base of manifest, reports and verified tables that generate the page's data, instead of typing them into law.js from whatever was read

Status: Accepted
Date: 2026-11-14
Narrows: [ADR-0014](0014-law-figures-not-settings.md)

## Context

Until 14 November 2026 every legal figure was typed into `src/law.js` from a source read once. Two were territorial: the overnight bonus came from the Convenio del campo de Huesca 2015–2017, which had expired, and the model applied it to every offer with a night stay wherever the job was; the annual hours came from Granada's expired agreement. The owner's table of four provincial agreements (Huesca, Cataluña, Cantabria, País Vasco/Navarra) showed the bonus in Huesca alone. Research on 13 November 2026 found public holidays published per community and per municipality, in bulletins and open datasets that change yearly and are corrected after publication, and no country-wide dataset of local holidays.

The owner asked for a structure that can grow with the page: documents kept with links to the originals and their dates, distilled reports that a coding agent reads instead of the originals, and tables by year and place that the calculations read, with a retrieval index (RAG) far in the future. The repository is public and published as it is; the owner's own documents are private; cloud sessions cannot reach some official hosts, while GitHub Actions can. The owner does not want an organisation of servers around a small page.

Weighed and discarded:
- Adding territorial figures by hand to `law.js`: no record of which document version a figure came from, no verification state, and the file would grow with thousands of holiday rows.
- Original PDFs in git: they stay in the history for good. A separate repository or an object store: one more place to manage, or a key and a bill.
- Letting agents commit extracted figures to `master`, as the schema snapshot is committed: a wrong figure reaches real shepherds' claims.
- Fetching holidays at run time from third-party APIs (Nager.Date, `date-holidays`, Google Calendar): incomplete for Aragón and without municipal data.
- Inferring local holidays from the saint's calendar: patrons and festivals are not in any per-municipality dataset, dates move (to the Monday after, a romería), and the two days are chosen each year by the labour authority; it can suggest a candidate, never assert one.
- GPU or machine-learning hosting: the work is a yearly and monthly batch of fetching and reading documents; nothing in it needs it.

## Decision

- The chain runs one way: originals → manifest → reports → tables → code. Each stage cites the one before by id, and nothing reaches `src/` without a manifest id and an article.
- `kb/manifest.json` records every document: id, publisher, jurisdiction codes, type, authority (official, secondary, owner-provided), source URLs, publication, in-force and retrieval dates, sha256, storage, licence, supersession, status. Original files are release assets of this repository, one release per year; text extracts are committed in `kb/text/` (Markdown with article headings); the owner's private documents are listed and never stored.
- One report per topic, territory and year in `kb/reports/`, led by «For the page», is what a coding agent reads.
- `kb/tables/*.csv` hold one fact per row: territory (`es`, `ccaa:`, `prov:`, `mun:` with INE codes), validity dates, value, unit, source id and article, a verbatim quote, and a status (extracted, checked, verified). Only rows the owner verified reach the page.
- `scripts/build-law-data.js` validates the tables (schema, ranges, counts, quotes found in the text, year-over-year diff) and generates `src/law-territorial.js` and `data/holidays-<year>-<community>.json`; neither is edited by hand. `law.js` keeps the national yearly figures and stays the only way code reads a legal figure: territorial figures come through its lookups, each returning its source.
- Where no agreement is known for a territory, the general rules of Spain apply, and the page never claims more than the entitlement the sources establish. The overnight bonus is owed only where a known agreement gives it (Huesca so far), never presumed elsewhere; a bonus written in the offer itself is agreed pay, not a legal minimum.
- Review is a summary, not a pull request: for each new or changed figure the main agent shows the owner a table (figure, value, verbatim quote, link to the original) in the session, and the row is marked verified on the owner's word. No pull requests, as `AGENTS.md` says.
- Holidays by ladder: the official list of the year when published; otherwise the dates of the last official year, marked estimated; a patron-saint suggestion only as a prompt to the user, marked unconfirmed, never stored as data; or a manual entry of the two local days kept with the offer.
- Scale: no servers. The jobs begin as on-demand sessions run by the main agent, then a GitHub Action for the fetching (open network), then scheduled sessions for the yearly review (January) and a monthly check for new publications. The retrieval index comes last; stable ids, article-level text and metadata are what keeps the door open.

## Consequences

- The overnight bonus follows the offer's province; where no agreement is known it is not counted as owed, and offers outside Huesca lose a figure the model used to add.
- A figure in the page can be traced to an article, a document version and the verification that let it in.
- Each new territory costs research and one review; coverage grows slowly, starting with Aragón and Huesca.
- The release assets live outside git: deleting a release loses the copies, though the manifest keeps URLs and hashes.
- `kb/` is published with the page, so it holds only public material.
- The holiday ladder can show a date that is estimated or unconfirmed; the screens say so wherever one is used.
