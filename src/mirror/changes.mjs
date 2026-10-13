// .pega/prev/: what the last sync replaced, for `pega-ctx changes`. Written by sync before it recomputes
// the mirror: the index before it, the digests before it of the rules it changed or removed, and
// sync.json (from, at, added, changed, removed). Ignored by git (its own .gitignore).
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const MAX_DIFF = 20;

function folder(m) {
  return join(m.paths.base, 'prev');
}

const digestFile = (m, id) => {
  const [type, ...rest] = id.split(':');
  const name = rest.pop();
  return join(folder(m), 'digest', type, rest.join(':') || '_', `${name}.md`);
};

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// Before the rebuild: the index and the digests the sync is about to replace.
export function keepPrevious(m, previousIndex, touched) {
  rmSync(folder(m), { recursive: true, force: true });
  write(join(folder(m), '.gitignore'), '*\n');
  write(join(folder(m), 'index.jsonl'), previousIndex.map((l) => JSON.stringify(l)).join('\n') + (previousIndex.length ? '\n' : ''));
  for (const id of [...touched.changed, ...touched.removed]) {
    const md = m.readDigest(id);
    if (md !== undefined) write(digestFile(m, id), md);
  }
}

export function recordSync(m, sync) {
  write(join(folder(m), 'sync.json'), `${JSON.stringify(sync, null, 2)}\n`);
}

export function readSync(m) {
  const file = join(folder(m), 'sync.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
}

export function readPreviousIndex(m) {
  const file = join(folder(m), 'index.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

export function readPreviousDigest(m, id) {
  const file = digestFile(m, id);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

// "2026-10-13T09:00:00.000Z" + "dev.un" → "2026-10-13 09:00 by dev.un".
export const when = (line = {}) => [line.updated ? line.updated.slice(0, 16).replace('T', ' ') : null, line.by ? `by ${line.by}` : null].filter(Boolean).join(' ');

// The lines of a digest that changed, without the update line and the Cited by section, which every
// sync rewrites. Lines removed then added, MAX_DIFF at most.
export function digestDiff(before = '', after = '', id = '') {
  const meaningful = (md) => md.split('\n## Cited by')[0].split('\n').filter((l) => l.trim() && !l.startsWith('updated: '));
  const a = meaningful(before);
  const b = meaningful(after);
  const removed = a.filter((l) => !b.includes(l)).map((l) => `    - ${l}`);
  const added = b.filter((l) => !a.includes(l)).map((l) => `    + ${l}`);
  const all = [...removed, ...added];
  if (all.length <= MAX_DIFF) return all;
  return [...all.slice(0, MAX_DIFF), `    … ${all.length - MAX_DIFF} more lines: pega-ctx rule ${id}`];
}
