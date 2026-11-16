// The knowledge base in kb/ (ADR-0033).
// `npm run law-data -- --check` validates the tables and lists their coverage.
// `npm run law-data` writes src/law-territorial.js from the verified holiday rows.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../kb', import.meta.url));
const TERRITORIAL_FILE = fileURLToPath(new URL('../src/law-territorial.js', import.meta.url));

/**
 * Province code of the places list → community. The module keeps only the provinces whose community has verified
 * rows. Add a province here with its community's INE code.
 */
const COMMUNITY_OF_PROVINCE = { HU: 'ccaa:02', TE: 'ccaa:02', Z: 'ccaa:02' };
/** Province code of the places list for each province territory of the tables, to key the agreement terms. */
const PROVINCE_OF_TERRITORY = { 'prov:22': 'HU', 'prov:44': 'TE', 'prov:50': 'Z' };

const DOC_STATUSES = ['candidate', 'current', 'superseded', 'owner-provided'];
const ROW_STATUSES = ['extracted', 'checked', 'verified'];
const STORAGES = ['link-only', 'release', 'owner-private'];
const AUTHORITIES = ['official', 'secondary', 'owner-provided'];
const MANIFEST_FIELDS = [
  'id',
  'title',
  'publisher',
  'jurisdiction',
  'doc_type',
  'authority',
  'source_urls',
  'published',
  'in_force',
  'retrieved',
  'sha256',
  'storage',
  'text',
  'licence',
  'supersedes',
  'superseded_by',
  'corrected_by',
  'status',
];

const MANIFEST_OPTIONAL_FIELDS = ['text_from', 'supplements', 'supplemented_by', 'note'];

const HOLIDAY_COLUMNS = [
  'territory',
  'year',
  'date',
  'name',
  'scope',
  'source_id',
  'source_ref',
  'quote',
  'status',
  'verified_by',
  'note',
];
const HOLIDAY_SCOPES = ['national', 'regional', 'local', 'substitute'];

const TERMS_COLUMNS = [
  'territory',
  'valid_from',
  'valid_to',
  'concept',
  'value',
  'unit',
  'applies_to',
  'source_id',
  'source_ref',
  'quote',
  'status',
  'verified_by',
  'note',
];
/** Allowed unit and range of each concept; a value outside its range is a typing error, not a legal change. */
const TERM_CONCEPTS = {
  overnight_pct: { units: ['pct_of_salary'], min: 0, max: 200 },
  overtime_premium_pct: { units: ['pct_over_hour'], min: 0, max: 200 },
  overtime_holiday_premium_pct: { units: ['pct_over_hour'], min: 0, max: 200 },
  overtime_flat_eur: { units: ['eur_per_hour'], min: 0, max: 100 },
  weekly_hours: { units: ['hours'], min: 35, max: 40 },
  annual_hours: { units: ['hours'], min: 1000, max: 2000 },
  vacation_days: { units: ['natural_days', 'working_days'], min: 22, max: 40 },
  board_pct: { units: ['pct_of_salary'], min: 0, max: 200 },
  lodging_pct: { units: ['pct_of_salary'], min: 0, max: 200 },
  mileage_eur_km: { units: ['eur_per_km'], min: 0, max: 2 },
  mileage_free_km: { units: ['km'], min: 0, max: 100 },
  night_work_pct: { units: ['pct_of_salary'], min: 0, max: 200 },
  extra_pays: { units: ['count'], min: 0, max: 6 },
};

const TERRITORY = /^(es|ccaa:\d{2}|prov:\d{2}|mun:\d{5})$/;
const NATIONAL_PLUS_REGIONAL = { min: 12, max: 15 };
const LOCAL_PER_MUNICIPALITY = 2;

/** BOE annex of the year's holidays and the community's name in it, to cross-check the national and regional rows. */
const BOE_ANNEX = { 2026: 'BOE-A-2025-21667' };
const BOE_COMMUNITY = { 'ccaa:02': 'Aragón' };
const MONTH_NUMBER = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12,
};
/** Open-data copy of Aragón's local list, to cross-check the local rows of Aragón (prov:22, 44, 50). */
const ARAGON_LOCAL_CSV = 'ARAGON-OD-festivos-2026-completo';
/** Open-data copy of Aragón's national and regional days. */
const ARAGON_REGIONAL_CSV = 'ARAGON-OD-festivos-2026-ccaa';

/** Minimal RFC 4180 reader: quoted fields with commas, doubled quotes and newlines. Returns rows of strings. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

/** @returns {Record<string, string>[]} the rows as objects, or throws on a header that is not `columns`. */
function readTable(file, columns) {
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'));
  if (header.join(',') !== columns.join(','))
    throw new Error(`${file}: columns are «${header.join(',')}», expected «${columns.join(',')}»`);
  return rows.map((cells, i) => {
    if (cells.length !== columns.length) throw new Error(`${file}: row ${i + 2} has ${cells.length} cells`);
    return Object.fromEntries(columns.map((name, j) => [name, cells[j]]));
  });
}

const isIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

/**
 * Checks manifest and tables under `root`.
 * @param {string} [root] the kb folder
 * @returns {{ errors: string[], warnings: string[], coverage: string[] }}
 */
export function validateKb(root = DEFAULT_ROOT) {
  const errors = [];
  const warnings = [];
  const coverage = [];
  /** Records an error; returns false so a check can `return fail(...)`. */
  const fail = (message) => {
    errors.push(message);
    return false;
  };

  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const documents = new Map();
  if (!Array.isArray(manifest)) fail('manifest.json is not an array');
  for (const doc of Array.isArray(manifest) ? manifest : []) {
    const where = `manifest ${doc.id}`;
    for (const field of MANIFEST_FIELDS) if (!(field in doc)) fail(`${where}: missing field «${field}»`);
    for (const field of Object.keys(doc))
      if (![...MANIFEST_FIELDS, ...MANIFEST_OPTIONAL_FIELDS].includes(field))
        fail(`${where}: unknown field «${field}»`);
    if (documents.has(doc.id)) fail(`${where}: duplicate id`);
    documents.set(doc.id, doc);
    if (!DOC_STATUSES.includes(doc.status)) fail(`${where}: status «${doc.status}»`);
    if (!STORAGES.includes(doc.storage)) fail(`${where}: storage «${doc.storage}»`);
    if (!AUTHORITIES.includes(doc.authority)) fail(`${where}: authority «${doc.authority}»`);
    for (const code of doc.jurisdiction ?? []) if (!TERRITORY.test(code)) fail(`${where}: jurisdiction «${code}»`);
    if (doc.published && !isIsoDate(doc.published)) fail(`${where}: published «${doc.published}» is not an ISO date`);
    if (doc.retrieved && !isIsoDate(doc.retrieved)) fail(`${where}: retrieved «${doc.retrieved}» is not an ISO date`);
    const fetched = doc.status === 'current' || doc.status === 'superseded';
    if (fetched && !/^[0-9a-f]{64}$/.test(doc.sha256 ?? '')) fail(`${where}: sha256 missing or malformed`);
    if (fetched && !(doc.source_urls?.length > 0)) fail(`${where}: no source_urls`);
    if (doc.storage === 'owner-private' && (doc.text || doc.sha256))
      fail(`${where}: a private document has no text or hash here`);
    if (doc.text) {
      const file = join(root, doc.text);
      if (!existsSync(file)) fail(`${where}: text file ${doc.text} is missing`);
      else if (!readFileSync(file, 'utf8').startsWith(`---\nid: ${doc.id}\n`))
        fail(`${where}: ${doc.text} does not start with its id`);
    } else if (fetched) fail(`${where}: no text extract`);
    for (const other of [
      ...(doc.supersedes ?? []),
      ...(doc.superseded_by ?? []),
      ...(doc.corrected_by ?? []),
      ...(doc.supplements ?? []),
      ...(doc.supplemented_by ?? []),
    ])
      if (!manifest.some((d) => d.id === other)) fail(`${where}: refers to unknown id «${other}»`);
  }

  const texts = new Map();
  const textOf = (id) => {
    if (!texts.has(id)) {
      const doc = documents.get(id);
      texts.set(id, doc?.text && existsSync(join(root, doc.text)) ? readFileSync(join(root, doc.text), 'utf8') : null);
    }
    return texts.get(id);
  };

  /** Checks the columns every row shares; returns false when the row cannot be checked further. */
  const checkCommon = (row, where) => {
    if (!TERRITORY.test(row.territory)) fail(`${where}: territory «${row.territory}»`);
    if (!documents.has(row.source_id)) return fail(`${where}: source_id «${row.source_id}» is not in the manifest`);
    if (!row.source_ref.trim()) fail(`${where}: empty source_ref`);
    if (!ROW_STATUSES.includes(row.status)) fail(`${where}: status «${row.status}»`);
    if (row.status === 'verified' && !row.verified_by) fail(`${where}: verified without verified_by`);
    if (row.status !== 'verified' && row.verified_by) fail(`${where}: verified_by on a row that is not verified`);
    if (!row.quote.trim()) return fail(`${where}: empty quote`);
    const text = textOf(row.source_id);
    if (text === null) return fail(`${where}: no text for ${row.source_id}`);
    if (!text.includes(row.quote))
      return fail(`${where}: quote not found verbatim in ${row.source_id}: «${row.quote.slice(0, 70)}»`);
    if (row.status === 'extracted') warnings.push(`${where}: still «extracted»`);
    return true;
  };

  // Holidays
  const holidays = readTable(join(root, 'tables', 'holidays.csv'), HOLIDAY_COLUMNS);
  const seenDays = new Set();
  const regionalDays = new Map();
  const localDays = new Map();
  for (const [i, row] of holidays.entries()) {
    const where = `holidays row ${i + 2} (${row.territory} ${row.date})`;
    checkCommon(row, where);
    if (!isIsoDate(row.date)) fail(`${where}: date is not ISO`);
    else if (row.date.slice(0, 4) !== row.year) fail(`${where}: year ${row.year} differs from the date`);
    if (!HOLIDAY_SCOPES.includes(row.scope)) fail(`${where}: scope «${row.scope}»`);
    if (!row.name.trim()) fail(`${where}: empty name`);
    const key = `${row.territory}|${row.date}`;
    if (seenDays.has(key)) fail(`${where}: duplicate territory and date`);
    seenDays.add(key);
    const group = `${row.territory}|${row.year}`;
    if (row.scope === 'local') {
      if (!row.territory.startsWith('mun:')) fail(`${where}: a local day belongs to a municipality`);
      localDays.set(group, [...(localDays.get(group) ?? []), row]);
    } else {
      if (!row.territory.startsWith('ccaa:') && row.territory !== 'es')
        fail(`${where}: a ${row.scope} day belongs to a community`);
      regionalDays.set(group, [...(regionalDays.get(group) ?? []), row]);
    }
  }
  for (const [group, rows] of regionalDays) {
    const [territory, year] = group.split('|');
    const { min, max } = NATIONAL_PLUS_REGIONAL;
    if (rows.length < min || rows.length > max)
      fail(`holidays ${group}: ${rows.length} national and regional days, expected ${min}–${max}`);
    const annex = textOf(BOE_ANNEX[year]);
    const community = BOE_COMMUNITY[territory];
    if (annex && community) {
      const inAnnex = [...annex.matchAll(new RegExp(`^- ${community}: (\\d+) .*? \\((\\w+)\\) `, 'gm'))].map(
        (m) => `${year}-${String(MONTH_NUMBER[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`,
      );
      const inTable = rows.map((r) => r.date);
      for (const date of inAnnex)
        if (!inTable.includes(date)) fail(`holidays ${group}: ${date} is in the BOE annex, not in the table`);
      for (const date of inTable)
        if (!inAnnex.includes(date)) fail(`holidays ${group}: ${date} is in the table, not in the BOE annex`);
    }
    const openData = territory === 'ccaa:02' && year === '2026' ? textOf(ARAGON_REGIONAL_CSV) : null;
    if (openData) {
      const listed = [...openData.matchAll(/^(\d{2})-(\d{2})-(\d{4});/gm)].map((m) => `${m[3]}-${m[2]}-${m[1]}`);
      for (const row of rows)
        if (!listed.includes(row.date)) fail(`holidays ${group}: ${row.date} is not in the Aragón open-data CSV`);
      if (listed.length !== rows.length)
        fail(`holidays ${group}: ${rows.length} rows, the open-data CSV has ${listed.length}`);
    }
  }
  const aragonCsv = textOf(ARAGON_LOCAL_CSV);
  for (const [group, rows] of localDays) {
    if (rows.length !== LOCAL_PER_MUNICIPALITY)
      fail(`holidays ${group}: ${rows.length} local days, expected ${LOCAL_PER_MUNICIPALITY}`);
    if (!aragonCsv) continue;
    for (const row of rows) {
      const ine = row.territory.slice(4);
      const [day, month, year] = [row.date.slice(8), row.date.slice(5, 7), row.date.slice(0, 4)];
      const name = row.quote.split('. ')[0];
      const line = new RegExp(
        `^Huesca;(${ine}|);${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};${day}-${month}-${year};`,
        'm',
      );
      if (!line.test(aragonCsv))
        fail(`holidays ${group}: ${row.date} is not in the Aragón open-data CSV for «${name}»`);
    }
  }

  // Agreement terms
  const terms = readTable(join(root, 'tables', 'agreement_terms.csv'), TERMS_COLUMNS);
  for (const [i, row] of terms.entries()) {
    const where = `agreement_terms row ${i + 2} (${row.territory} ${row.concept})`;
    checkCommon(row, where);
    const concept = TERM_CONCEPTS[row.concept];
    if (!concept) {
      fail(`${where}: concept «${row.concept}»`);
      continue;
    }
    if (!concept.units.includes(row.unit)) fail(`${where}: unit «${row.unit}», expected ${concept.units.join(' or ')}`);
    const value = Number(row.value);
    if (row.value === '' || Number.isNaN(value) || value < concept.min || value > concept.max)
      fail(`${where}: value «${row.value}» outside ${concept.min}–${concept.max}`);
    if (!isIsoDate(row.valid_from)) fail(`${where}: valid_from is not ISO`);
    if (row.valid_to !== '' && !isIsoDate(row.valid_to)) fail(`${where}: valid_to is not ISO`);
    if (row.valid_to && row.valid_to < row.valid_from) fail(`${where}: valid_to before valid_from`);
    if (row.territory === 'es') fail(`${where}: agreement terms belong to a province or community`);
  }

  // Coverage
  for (const [group, rows] of regionalDays)
    coverage.push(`holidays ${group}: ${rows.length} national and regional days`);
  const byProvince = new Map();
  for (const [group] of localDays) byProvince.set(group.split('|')[1], (byProvince.get(group.split('|')[1]) ?? 0) + 1);
  for (const [year, count] of byProvince) coverage.push(`holidays local ${year}: ${count} municipalities, 2 days each`);
  for (const [group, rows] of localDays)
    coverage.push(
      `  ${group}: ${rows.map((r) => r.date.slice(5)).join(' ')} (${rows[0].source_id}, ${rows[0].status})`,
    );
  const termGroups = new Map();
  for (const row of terms)
    termGroups.set(
      `${row.territory} ${row.valid_from}..${row.valid_to}`,
      (termGroups.get(`${row.territory} ${row.valid_from}..${row.valid_to}`) ?? 0) + 1,
    );
  for (const [group, count] of termGroups) coverage.push(`agreement terms ${group}: ${count} figures`);
  if (terms.length === 0) coverage.push('agreement terms: no rows (official agreement text not in kb/text yet)');
  const unverified = [...holidays, ...terms].filter((r) => r.status !== 'verified').length;
  coverage.push(
    `rows: ${holidays.length + terms.length}, owner-verified: ${holidays.length + terms.length - unverified}`,
  );

  return { errors, warnings, coverage };
}

/** A verified holiday row as the page reads it. */
const holidayOf = (row, documents) => ({
  date: row.date,
  name: row.name,
  scope: row.scope,
  cite: { id: row.source_id, label: row.source_ref, url: documents.get(row.source_id).source_urls[0] ?? null },
});

/** A verified agreement row as the page reads it; the article is for law.js to put after the agreement's name. */
const agreementTermOf = (row, documents) => ({
  value: Number(row.value),
  unit: row.unit,
  from: row.valid_from,
  to: row.valid_to || null,
  appliesTo: row.applies_to,
  cite: { id: row.source_id, article: row.source_ref, url: documents.get(row.source_id).source_urls[0] ?? null },
});

/** Appends `item` to `map[key1][key2]`. */
function push(map, key1, key2, item) {
  map[key1] ??= {};
  map[key1][key2] ??= [];
  map[key1][key2].push(item);
}

/**
 * Source of src/law-territorial.js: the verified rows only: holidays by community and year (national and regional days)
 * and by municipality's INE code and year (local days), agreement terms by province and concept. Throws if the knowledge base has errors.
 * @param {string} [root] the kb folder
 * @returns {string}
 */
export function buildTerritorialModule(root = DEFAULT_ROOT) {
  const { errors } = validateKb(root);
  if (errors.length) throw new Error(`kb has errors, nothing generated:\n${errors.join('\n')}`);
  const documents = new Map(JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).map((d) => [d.id, d]));
  const rows = readTable(join(root, 'tables', 'holidays.csv'), HOLIDAY_COLUMNS)
    .filter((row) => row.status === 'verified')
    .sort((a, b) => a.date.localeCompare(b.date) || a.territory.localeCompare(b.territory));
  const regional = {};
  const local = {};
  for (const row of rows) {
    if (row.scope === 'local') push(local, row.territory.slice(4), row.year, holidayOf(row, documents));
    else push(regional, row.territory, row.year, holidayOf(row, documents));
  }
  const provinces = Object.fromEntries(
    Object.entries(COMMUNITY_OF_PROVINCE)
      .filter(([, community]) => community in regional)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  /** @type {Record<string, Record<string, ReturnType<typeof agreementTermOf>[]>>} */
  const agreements = {};
  const termRows = readTable(join(root, 'tables', 'agreement_terms.csv'), TERMS_COLUMNS)
    .filter((row) => row.status === 'verified')
    .sort((a, b) => a.concept.localeCompare(b.concept) || a.valid_from.localeCompare(b.valid_from));
  for (const row of termRows) {
    const province = PROVINCE_OF_TERRITORY[row.territory];
    if (!province) throw new Error(`agreement term ${row.concept}: ${row.territory} has no province code`);
    push(agreements, province, row.concept, agreementTermOf(row, documents));
  }
  return `// generated by scripts/build-law-data.js from kb/tables; do not edit
// Read through holidaysOf and agreementOf in law.js.

/**
 * @typedef {{ id: string, label: string, url: string | null }} HolidayCite source id in kb/manifest.json, article, link
 * @typedef {{ date: string, name: string, scope: string, cite: HolidayCite }} HolidayRow
 * @type {{
 *   provinces: Record<string, string>,
 *   regional: Record<string, Record<string, HolidayRow[]>>,
 *   local: Record<string, Record<string, HolidayRow[]>>,
 * }}
 */
export const HOLIDAY_DATA = ${JSON.stringify({ provinces, regional, local }, null, 2)};

/**
 * Verified collective-agreement figures by province code of the places list and concept, oldest first.
 * @typedef {{ id: string, article: string, url: string | null }} AgreementCite source id in kb/manifest.json, article, link
 * @typedef {{ value: number, unit: string, from: string, to: string | null, appliesTo: string, cite: AgreementCite }} AgreementTerm
 * @type {Record<string, Record<string, AgreementTerm[]>>}
 */
export const AGREEMENT_DATA = ${JSON.stringify(agreements, null, 2)};
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--check')) {
    writeFileSync(TERRITORIAL_FILE, buildTerritorialModule());
    console.log('wrote src/law-territorial.js');
    process.exit(0);
  }
  const { errors, warnings, coverage } = validateKb();
  for (const line of coverage) console.log(line);
  for (const line of warnings) console.warn(`warning: ${line}`);
  for (const line of errors) console.error(`error: ${line}`);
  if (errors.length) process.exit(1);
  console.log('kb: ok');
}
