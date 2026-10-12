// pega-ctx measure [--raw <folder>] [--json]: per type, number of rules, average size of the raw rule
// and of the digest, ratio. The proof that the tool helps; run again after each projection change.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../projection/index.mjs';

export const help = 'pega-ctx measure [--raw <folder>] [--json]';

// The raw rules of a folder laid out as <Type>/<Class>/<Name>.toon (raw/ of the mirror or of the fixture).
export function readRaws(folder) {
  const raws = [];
  for (const type of readdirSync(folder)) {
    if (!statSync(join(folder, type)).isDirectory()) continue;
    for (const cls of readdirSync(join(folder, type))) {
      for (const f of readdirSync(join(folder, type, cls)).filter((f) => f.endsWith('.toon'))) {
        const name = f.replace(/\.toon$/, '');
        raws.push({ id: `${type}:${cls}:${name}`, type, class: cls, name, toon: readFileSync(join(folder, type, cls, f), 'utf8') });
      }
    }
  }
  return raws;
}

export function measure(raws) {
  const index = raws.map(({ id, type, class: cls, name }) => ({ id, type, class: cls, name }));
  const byType = new Map();
  for (const r of raws) {
    const digest = project(r.toon, { index }).markdown;
    const t = byType.get(r.type) ?? { type: r.type, rules: 0, raw: 0, digest: 0 };
    t.rules += 1;
    t.raw += Buffer.byteLength(r.toon);
    t.digest += Buffer.byteLength(digest);
    byType.set(r.type, t);
  }
  const rows = [...byType.values()].sort((a, b) => a.type.localeCompare(b.type));
  const total = rows.reduce((t, l) => ({ type: 'total', rules: t.rules + l.rules, raw: t.raw + l.raw, digest: t.digest + l.digest }), { type: 'total', rules: 0, raw: 0, digest: 0 });
  return [...rows, total].map((l) => ({
    type: l.type,
    rules: l.rules,
    rawAverage: Math.round(l.raw / l.rules),
    digestAverage: Math.round(l.digest / l.rules),
    ratio: Math.round((l.raw / l.digest) * 10) / 10,
  }));
}

export function run({ options, root = process.cwd() }) {
  const folder = typeof options.raw === 'string' ? options.raw : join(root, '.pega', 'raw');
  if (!existsSync(folder)) {
    return { code: 1, output: `no raw rules in ${folder}: run pega-ctx sync, or give a folder with --raw` };
  }
  const raws = readRaws(folder);
  if (!raws.length) return { code: 1, output: `no .toon file in ${folder}: run pega-ctx sync --full` };
  const rows = measure(raws);
  if (options.json) return { code: 0, output: JSON.stringify(rows, null, 2) };
  const table = [
    '| type | rules | raw average (B) | digest average (B) | ratio |',
    '|---|---:|---:|---:|---:|',
    ...rows.map((r) => `| ${r.type} | ${r.rules} | ${r.rawAverage} | ${r.digestAverage} | ×${r.ratio} |`),
  ];
  return { code: 0, output: table.join('\n') };
}
