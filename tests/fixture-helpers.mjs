// Reading the fixture, shared by the tests: raw rules, list() rows, rule index.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const FIXTURE = join(import.meta.dirname, 'fixture');
export const RAW = join(FIXTURE, 'raw');
export const DIGEST = join(FIXTURE, 'digest');

export const raws = readdirSync(RAW).flatMap((type) =>
  readdirSync(join(RAW, type)).flatMap((folder) =>
    readdirSync(join(RAW, type, folder)).map((f) => {
      const name = f.replace(/\.toon$/, '');
      // A rule with no class (EditValidate) sits in the folder `_`.
      const cls = folder === '_' ? '' : folder;
      return { id: `${type}:${cls}:${name}`, type, class: cls, folder, name, file: join(RAW, type, folder, f) };
    }),
  ),
);

export const rows = readFileSync(join(FIXTURE, 'list.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

// CaseType: list() returns the name in upper case (pxInsName), the raw rule has the real name.
export function rowOf(r) {
  return rows.find((l) => l.type === r.type && l.class === r.class && l.name.toLowerCase() === r.name.toLowerCase());
}

export const index = raws.map(({ id, type, class: cls, name }) => ({ id, type, class: cls, name }));

export const read = (r) => readFileSync(r.file, 'utf8');
