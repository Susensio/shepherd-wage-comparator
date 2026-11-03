# ADR-0019: Search villages with MiniSearch instead of a hand-written fuzzy matcher

Status: Accepted
Date: 2026-11-03

## Context

The village field searches about 31,600 places (`data/places-*.json`, from GeoNames). Typing mistakes («Benasqe», «Sabiñaningo», «Javierre» for the listed «Jabierre») found nothing. A first fix treated b and v alike; a second wrote edit-distance matching by hand, with its own word splitting, limits and speed work (reused buffers, distinct words measured once). The owner asked whether this was reinventing the wheel (3 November 2026) and chose MiniSearch.

Weighed and discarded:
- Keeping the hand-written matcher (about 120 lines, tested, 5–20 ms per search): we would own the tuning and the speed.
- Fuse.js: slow on 31,600 items and its scores are hard to predict.
- uFuzzy: very fast and small, but made for out-of-order substrings, with little typo tolerance.

## Decision

- MiniSearch 7.2.0, vendored as its ES module into `vendor/minisearch/` (`npm run vendor`, the source-map comment dropped), mapped as `minisearch` in the import map; Node resolves the same name from `node_modules`.
- Each place is indexed by its name and its municipality, the name weighted three times; terms go through `fold`. Prefix matching on; mistakes allowed: none under 4 letters, one up to 7, two from 8. Words of two letters or fewer are dropped, except the last one, still being typed.
- On top of MiniSearch's scores, one rule no library knows: more typed words matched first, then places in a municipality where the other typed words also match a place («Javierre de Olsón»: Jabierre and Olsón, both in Aínsa-Sobrarbe), then the earlier word.

## Consequences

- Typing from the middle of a word («ains» for Ribainsa) no longer finds anything.
- Typing a municipality lists its villages after the exact match.
- The index takes about 200 ms to build in Chromium (40 ms before), about 1.1 s with the CPU slowed 4× as on a modest phone. The page builds it in chunks of 1,000 places (`buildIndexInChunks`, MiniSearch's `addAllAsync`): no task over 50 ms at 4×, so typing elsewhere stays smooth while the list loads. Searches take about 1–10 ms.
- Full names missing from GeoNames («Jabierre de Olsón») are a data problem, not a search one: see the backlog item on INE's Nomenclátor.
