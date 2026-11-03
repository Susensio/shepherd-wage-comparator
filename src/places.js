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

/** For searching only: b and v sound the same in Spanish, so «Javierre» finds «Jabierre». */
const searchKey = (text) => fold(text).replace(/v/g, 'b');

/** Short words that do not tell places apart («de», «del», «la»…), left out when a name is searched word by word. */
const MIN_WORD = 4;

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
    rows: file.places.map(([name, municipality]) => ({ folded: searchKey(name), name, municipality })),
  };
}

/** @typedef {ReturnType<typeof buildIndex>} PlacesIndex */

/**
 * Up to eight places for what was typed: names starting with it first, then those with a word starting with it,
 * then those containing it; shorter names first within each group. b and v count as the same letter. A full name the
 * list does not hold («Javierre de Olsón», listed as «Jabierre») falls back to its words: places named by one of them,
 * those whose municipality has another of the words' places first.
 * @param {PlacesIndex} index
 * @param {string} query
 * @returns {Place[]}
 */
export function searchPlaces(index, query) {
  const wanted = searchKey(query);
  if (wanted.length < MIN_QUERY) return [];
  const found = matches(index.rows, wanted);
  const rows = found.length ? found : byWords(index.rows, wanted);
  return rows.slice(0, MAX_SUGGESTIONS).map((row) => ({ name: row.name, ...index.municipalities[row.municipality] }));
}

/** Rows containing `wanted`, best first. */
function matches(rows, wanted) {
  const starts = [];
  const words = [];
  const inside = [];
  for (const row of rows) {
    const at = row.folded.indexOf(wanted);
    if (at < 0) continue;
    if (at === 0) starts.push(row);
    else if (/[\s\-'(]/.test(row.folded[at - 1])) words.push(row);
    else inside.push(row);
  }
  const byLength = (a, b) => a.folded.length - b.folded.length;
  return [...starts.sort(byLength), ...words.sort(byLength), ...inside.sort(byLength)];
}

/** Rows named by one of the query's words; those sharing a municipality with another word's places first, then by word order. */
function byWords(rows, wanted) {
  const words = wanted.split(/[\s\-',()]+/).filter((word) => word.length >= MIN_WORD);
  if (words.length < 2) return [];
  const perWord = words.map((word) => matches(rows, word).filter((row) => row.folded.startsWith(word)));
  const municipalitiesOf = perWord.map((list) => new Set(list.map((row) => row.municipality)));
  const scored = perWord.flatMap((list, i) =>
    list.map((row) => ({
      row,
      word: i,
      shared: municipalitiesOf.filter((set, j) => j !== i && set.has(row.municipality)).length,
    })),
  );
  // The first word usually names the village («Jabierre de Olsón»): it goes first on a tie
  scored.sort((a, b) => b.shared - a.shared || a.word - b.word || a.row.folded.length - b.row.folded.length);
  const seen = new Set();
  return scored.map(({ row }) => row).filter((row) => !seen.has(row) && seen.add(row));
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
