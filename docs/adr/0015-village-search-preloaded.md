# ADR-0015: Place each offer by searching a village in a list kept in the browser, preloaded when an offer's form opens, instead of a province picker or an online place search

Status: Accepted
Date: 2026-11-01

## Context

On 31 October 2026 the owner wanted each offer to say where the job is and which herd it is, so offers can later be compared by place and by workload. Shepherds know their village, not always the municipality it belongs to. A spike page (a Claude artifact) compared three ways to find the municipality and province from a village name: the whole list of Spanish places in one file, one file per province, and Photon, an online search over OpenStreetMap.

Weighed and discarded:
- A province picker followed by a per-province file (about 10 KB each): fast on a weak signal, but one more step, and searching takes 2 ms once any list is loaded.
- Photon, or any online place search: every keystroke goes to a third party and needs signal; Photon returned the comarca but not the province.
- Google Places: a paid API key, and its terms tie results to a Google map.
- IGN's gazetteer as the source: richer in hamlets, but behind a download form; it has no comarca either.
- An exact location: with the sharer's name it would pinpoint the farm.

## Decision

- One search box over every populated place in Spain (GeoNames, CC BY 4.0, about 32,000 places with INE municipality codes), built into one versioned file by `npm run places`.
- The file is fetched in the background when an offer's form opens and kept in the browser's Cache Storage under its version, so it is downloaded once per version. With data saving on or a 2G line, it is fetched only when the location field is used.
- Saved: the INE municipality code and the province code in `terms`, shared; the village name in `mine`, never shared. Herd: one head count per species in `terms`.

## Consequences

- About 280 KB compressed on the first form opened per browser; nothing for people who only read results.
- The search works offline once the file is in the browser.
- IGN's list, or a comarca joined by municipality code, can replace or extend GeoNames without changing saved offers.
- A new version of the list needs a new version name, or browsers keep the old one.

