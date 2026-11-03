/** Spanish places for the location field: the compact list (data/places-*.json) as a searchable index. No DOM, no network. */

import MiniSearch from 'minisearch';

/**
 * The file's shape. Indexes point into the lists before them.
 * @typedef {{
 *   provinces: [code: string, name: string][],
 *   municipalities: [name: string, province: number, ineCode: string][],
 *   places: [name: string, municipality: number][],
 * }} PlacesFile
 */

/** @typedef {{ municipality: string, municipalityCode: string, province: string, provinceCode: string }} Area */
/** @typedef {Area & { name: string }} Place */

/** Lower case without accents, for matching what people type. */
export const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const ARTICLE_LAST = /^(.+), (L'|El|La|Los|Las|A|O|As|Os|Es|Sa|Ses|Els|Les)(\/.*)?$/i;

/**
 * INE writes the article last («Ènova, l'», «Puerto, El», «Pinós, el/Pinoso»): it goes back to the front, as people say
 * it. In a bilingual name («Lorcha/Orxa, l'») it belongs to the last variant.
 * @param {string} name
 */
export function articleFirst(name) {
  const match = ARTICLE_LAST.exec(name);
  if (!match) return name;
  const [, head, article, rest = ''] = match;
  const withArticle = (text) => `${article}${article.endsWith("'") ? '' : ' '}${text}`;
  const variants = head.split('/');
  if (variants.length > 1) return [...variants.slice(0, -1), withArticle(variants.at(-1))].join('/') + rest;
  const spoken = withArticle(head) + rest;
  return article.endsWith("'") ? spoken : spoken[0].toUpperCase() + spoken.slice(1);
}

export const MAX_SUGGESTIONS = 8;
const MIN_QUERY = 2;
/** Shortest query word matched with mistakes; shorter ones («de», «la») must match exactly or are left out. */
const MIN_FUZZY = 4;

/** Words of a name or query: «Aínsa-Sobrarbe» → ainsa, sobrarbe. */
const tokenize = (text) => text.split(/[\s\-',()/]+/).filter(Boolean);

/** Mistakes allowed in a word: one up to 7 letters, two from 8. */
const allowedMistakes = (word) => (word.length >= 8 ? 2 : word.length >= MIN_FUZZY ? 1 : 0);

/** Name matches count three times a municipality match. */
const NAME_BOOST = 3;

/** @param {{ name: string, municipality: string }[]} documents */
function buildSearcher(documents) {
  const searcher = new MiniSearch({
    fields: ['name', 'municipality'],
    tokenize,
    processTerm: fold,
    searchOptions: { prefix: true, fuzzy: allowedMistakes, boost: { name: NAME_BOOST }, combineWith: 'OR' },
  });
  searcher.addAll(documents);
  return searcher;
}

/**
 * The searchable index of a places file.
 * @param {PlacesFile} file
 */
export function buildIndex(file) {
  const municipalities = file.municipalities.map(([municipality, province, ineCode]) => ({
    municipality,
    municipalityCode: ineCode,
    province: file.provinces[province][1],
    provinceCode: file.provinces[province][0],
  }));
  const rows = file.places.map(([name, municipality]) => ({ name, municipality }));
  return {
    municipalities,
    /** @type {Map<string, string>} province code → name */
    provinces: new Map(file.provinces),
    byCode: new Map(municipalities.map((m) => [m.municipalityCode, m])),
    rows,
    searcher: buildSearcher(
      rows.map(({ name, municipality }, id) => ({ id, name, municipality: municipalities[municipality].municipality })),
    ),
  };
}

/** @typedef {ReturnType<typeof buildIndex>} PlacesIndex */

/**
 * Up to eight places for what was typed, as MiniSearch ranks them: words still being typed match as prefixes, and
 * words with spelling mistakes («Jabierre» for «Javierre») still match. Places matching more of the typed words
 * come first, then those in a municipality where the other words also match a place («Javierre de Olsón»: Jabierre
 * and Olsón, both in Aínsa-Sobrarbe), then the earlier typed word, then the better score.
 * @param {PlacesIndex} index
 * @param {string} query
 * @returns {Place[]}
 */
export function searchPlaces(index, query) {
  const wanted = fold(query);
  if (wanted.length < MIN_QUERY) return [];
  // «de» and «la» between words would match half the list; the last word is still being typed, so it stays
  const typed = tokenize(wanted).filter((word, i, words) => word.length > MIN_QUERY || i === words.length - 1);
  const hits = index.searcher.search(typed.join(' '));
  const wordsIn = new Map();
  for (const hit of hits) {
    const { municipality } = index.rows[hit.id];
    wordsIn.set(municipality, new Set([...(wordsIn.get(municipality) ?? []), ...hit.queryTerms]));
  }
  const shared = (hit) => wordsIn.get(index.rows[hit.id].municipality).size;
  const first = (hit) => Math.min(...hit.queryTerms.map((term) => typed.indexOf(term)));
  hits.sort(
    (a, b) =>
      b.queryTerms.length - a.queryTerms.length || shared(b) - shared(a) || first(a) - first(b) || b.score - a.score,
  );
  return hits.slice(0, MAX_SUGGESTIONS).map(({ id }) => {
    const row = index.rows[id];
    return { name: row.name, ...index.municipalities[row.municipality] };
  });
}

/**
 * The municipality and province names of an offer's terms, or null if it has none or the code is unknown.
 * @param {PlacesIndex} index
 * @param {{ municipality?: string, province?: string }} terms
 */
export function placeOfTerms(index, terms) {
  const municipality = index.byCode.get(terms.municipality ?? '');
  if (municipality) return { municipality: municipality.municipality, province: municipality.province };
  const province = index.provinces.get(terms.province ?? '');
  return province ? { municipality: '', province } : null;
}
