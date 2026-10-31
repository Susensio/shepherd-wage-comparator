// Builds data/places-<version>.json from GeoNames' Spain dump (CC BY 4.0): `npm run places [-- <dir>]`.
// <dir> holds ES.txt and admin2Codes.txt; without it they are downloaded. The version is PLACES_VERSION, in the loader.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { articleFirst, fold } from '../src/places.js';
import { PLACES_VERSION } from '../src/storage/places.js';

const DUMP = 'https://download.geonames.org/export/dump';

/** Column numbers of the GeoNames table (0-based). */
const COL = { name: 1, featureClass: 6, featureCode: 7, province: 11, ineCode: 12 };

async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

async function sourceDir(argument) {
  if (argument) return argument;
  const dir = mkdtempSync(join(tmpdir(), 'geonames-'));
  await download(`${DUMP}/admin2Codes.txt`, join(dir, 'admin2Codes.txt'));
  await download(`${DUMP}/ES.zip`, join(dir, 'ES.zip'));
  execFileSync('unzip', ['-o', '-q', join(dir, 'ES.zip'), 'ES.txt', '-d', dir]);
  return dir;
}

const lines = (file) => readFileSync(file, 'utf8').split('\n').filter(Boolean);

const dir = await sourceDir(process.argv[2]);

/** Province code → name; «ES.52.HU» is the admin2 key for Huesca. */
const provinceNames = new Map();
for (const line of lines(join(dir, 'admin2Codes.txt'))) {
  const [key, name] = line.split('\t');
  const [country, , code] = key.split('.');
  if (country === 'ES') provinceNames.set(code, name.replace(/^Provin?cia de /, '').replace(/^Província de /, ''));
}

const rows = lines(join(dir, 'ES.txt')).map((line) => line.split('\t'));

/** INE code → { name, province code }, from the municipalities (ADM3). */
const municipalities = new Map();
for (const row of rows)
  if (row[COL.featureCode] === 'ADM3' && row[COL.ineCode] && provinceNames.has(row[COL.province]))
    municipalities.set(row[COL.ineCode], { name: articleFirst(row[COL.name]), province: row[COL.province] });

/** Populated places inside a known municipality, and each municipality's own name (people type it too). */
const places = [];
for (const row of rows)
  if (row[COL.featureClass] === 'P' && municipalities.has(row[COL.ineCode]))
    places.push({ name: articleFirst(row[COL.name]), ineCode: row[COL.ineCode] });
for (const [ineCode, { name }] of municipalities) places.push({ name, ineCode });

const collator = new Intl.Collator('es');
const provinceCodes = [...new Set([...municipalities.values()].map((m) => m.province))].sort((a, b) =>
  collator.compare(provinceNames.get(a), provinceNames.get(b)),
);
const municipalityCodes = [...municipalities.keys()].sort(
  (a, b) => collator.compare(municipalities.get(a).name, municipalities.get(b).name) || (a < b ? -1 : 1),
);
const provinceIndex = new Map(provinceCodes.map((code, i) => [code, i]));
const municipalityIndex = new Map(municipalityCodes.map((code, i) => [code, i]));

const seen = new Set();
const unique = [];
for (const { name, ineCode } of places) {
  const folded = fold(name);
  const key = `${folded}|${ineCode}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push({ name, ineCode, folded });
}
unique.sort((a, b) => collator.compare(a.folded, b.folded) || (a.ineCode < b.ineCode ? -1 : 1));

const file = {
  provinces: provinceCodes.map((code) => [code, provinceNames.get(code)]),
  municipalities: municipalityCodes.map((code) => [
    municipalities.get(code).name,
    provinceIndex.get(municipalities.get(code).province),
    code,
  ]),
  places: unique.map(({ name, ineCode }) => [name, municipalityIndex.get(ineCode)]),
};

const out = new URL(`../data/places-${PLACES_VERSION}.json`, import.meta.url);
writeFileSync(out, JSON.stringify(file));
console.log(
  `${out.pathname}: ${file.provinces.length} provinces, ${file.municipalities.length} municipalities, ${file.places.length} places`,
);
