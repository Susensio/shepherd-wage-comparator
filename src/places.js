/** Spanish places for the location field: the compact list (data/places-*.json) as a searchable index. No DOM, no network. */

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
  return {
    municipalities,
    /** @type {Map<string, string>} province code → name */
    provinces: new Map(file.provinces),
    byCode: new Map(municipalities.map((m) => [m.municipalityCode, m])),
    rows: file.places.map(([name, municipality]) => ({ folded: fold(name), name, municipality })),
  };
}

/** @typedef {ReturnType<typeof buildIndex>} PlacesIndex */

/**
 * Up to eight places for what was typed: names starting with it first, then those with a word starting with it,
 * then those containing it; shorter names first within each group.
 * @param {PlacesIndex} index
 * @param {string} query
 * @returns {Place[]}
 */
export function searchPlaces(index, query) {
  const wanted = fold(query);
  if (wanted.length < MIN_QUERY) return [];
  const starts = [];
  const words = [];
  const inside = [];
  for (const row of index.rows) {
    const at = row.folded.indexOf(wanted);
    if (at < 0) continue;
    if (at === 0) starts.push(row);
    else if (/[\s\-'(]/.test(row.folded[at - 1])) words.push(row);
    else inside.push(row);
  }
  const byLength = (a, b) => a.folded.length - b.folded.length;
  return [...starts.sort(byLength), ...words.sort(byLength), ...inside.sort(byLength)]
    .slice(0, MAX_SUGGESTIONS)
    .map((row) => ({ name: row.name, ...index.municipalities[row.municipality] }));
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
