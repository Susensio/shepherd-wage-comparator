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
    rows: file.places.map(([name, municipality]) => {
      const folded = fold(name);
      return { folded, words: wordsOf(folded), name, municipality };
    }),
    /** Each distinct word of the names, measured once per search instead of once per place */
    get words() {
      const words = new Set(this.rows.flatMap((row) => row.words));
      Object.defineProperty(this, 'words', { value: [...words] });
      return this.words;
    },
  };
}

/** @typedef {ReturnType<typeof buildIndex>} PlacesIndex */

/** The words of a folded name, for fuzzy matching. */
const wordsOf = (folded) => folded.split(/[\s\-',()/]+/).filter(Boolean);

/** Shortest query word matched with mistakes; shorter ones («de», «la») must match exactly or are left out. */
const MIN_FUZZY = 4;
/** Mistakes allowed in a word: one up to 7 letters, two from 8. */
const allowedMistakes = (word) => (word.length >= 8 ? 2 : 1);

/**
 * Edits (a letter changed, added, removed, or two swapped) from `a` to `b`, or `max + 1` once it is sure to be more.
 * @param {string} a
 * @param {string} b
 * @param {number} max
 */
export function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (b.length + 1 > rowSize) growRows(b.length + 1);
  let before = rowA;
  let previous = rowB;
  let current = rowC;
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2] + 1);
      current[j] = d;
      if (d < best) best = d;
    }
    if (best > max) return max + 1;
    [before, previous, current] = [previous, current, before];
  }
  return previous[b.length];
}

// Three rows of the distance table, reused: a search measures thousands of words and should not allocate for each
let rowSize = 64;
let rowA = new Uint16Array(rowSize);
let rowB = new Uint16Array(rowSize);
let rowC = new Uint16Array(rowSize);
function growRows(size) {
  rowSize = size;
  rowA = new Uint16Array(size);
  rowB = new Uint16Array(size);
  rowC = new Uint16Array(size);
}

/** Mistakes between a typed word and a place's word, read whole or as the start of a longer one (still typing). */
function wordDistance(typed, word, max) {
  if (word.length < typed.length - max) return max + 1;
  const whole = word.length <= typed.length + max ? editDistance(typed, word, max) : max + 1;
  if (whole === 0 || word.length <= typed.length) return whole;
  return Math.min(whole, editDistance(typed, word.slice(0, typed.length), max));
}

/**
 * Up to eight places for what was typed: names starting with it first, then those with a word starting with it,
 * then those containing it; shorter names first within each group. If that leaves room, names close to what was
 * typed, word by word, with spelling mistakes («Jabierre» for «Javierre», «Jaka»): those matching more words first,
 * then those in a municipality where the other words also match a place («Javierre de Olsón»: Jabierre and Olsón,
 * both in Aínsa-Sobrarbe), then the first word's, then the fewest mistakes.
 * @param {PlacesIndex} index
 * @param {string} query
 * @returns {Place[]}
 */
export function searchPlaces(index, query) {
  const wanted = fold(query);
  if (wanted.length < MIN_QUERY) return [];
  const found = matches(index.rows, wanted);
  const rows = found.length >= MAX_SUGGESTIONS ? found : [...found, ...closeTo(index, wanted, new Set(found))];
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

/** Rows whose words are close to the typed words, best first; none of those in `skip`. */
function closeTo(index, wanted, skip) {
  const typed = wordsOf(wanted).filter((word) => word.length >= MIN_FUZZY);
  if (!typed.length) return [];
  // Per typed word: the place words within its mistakes, and how many
  const near = typed.map((word) => {
    const max = allowedMistakes(word);
    const close = new Map();
    for (const own of index.words) {
      const d = wordDistance(word, own, max);
      if (d <= max) close.set(own, d);
    }
    return close;
  });
  const hits = [];
  for (const row of index.rows) {
    if (skip.has(row) || !row.words.some((own) => near.some((close) => close.has(own)))) continue;
    let words = 0;
    let mistakes = 0;
    let first = typed.length;
    typed.forEach((_, i) => {
      let best = Number.POSITIVE_INFINITY;
      for (const own of row.words) best = Math.min(best, near[i].get(own) ?? best);
      if (!Number.isFinite(best)) return;
      words += 1;
      mistakes += best;
      first = Math.min(first, i);
    });
    if (words) hits.push({ row, words, mistakes, first });
  }
  // A municipality where several typed words each match a place: «Javierre de Olsón» → Jabierre and Olsón
  const wordsIn = new Map();
  for (const hit of hits) {
    const set = wordsIn.get(hit.row.municipality) ?? new Set();
    set.add(hit.first);
    wordsIn.set(hit.row.municipality, set);
  }
  const shared = (hit) => wordsIn.get(hit.row.municipality).size;
  hits.sort(
    (a, b) =>
      b.words - a.words ||
      shared(b) - shared(a) ||
      a.first - b.first ||
      a.mistakes - b.mistakes ||
      a.row.folded.length - b.row.folded.length,
  );
  return hits.map((hit) => hit.row);
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
