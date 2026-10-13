// pega-ctx changes [--since <date>] [--type T] [--class C]: what changed in Pega, as text.
// By default the last sync: one line per rule added, changed or removed, with its date and operator,
// then for a changed rule the lines of its digest that changed. --since: the rules of the index updated
// in Pega since that date (added and changed together; no removal, no CaseType: they have no date).
import { mirror } from '../mirror/files.mjs';
import { readSync, readPreviousIndex, readPreviousDigest, when, digestDiff } from '../mirror/changes.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx changes [--since <date>] [--type T] [--class C]';

export function run({ options, root }) {
  const m = mirror(root);
  m.readConfig();
  const index = m.readIndex();
  const keep = (id) => {
    const [type, ...rest] = id.split(':');
    const cls = rest.slice(0, -1).join(':');
    return (typeof options.type !== 'string' || type === options.type) && (typeof options.class !== 'string' || cls === options.class);
  };

  if (typeof options.since === 'string') {
    const since = new Date(options.since);
    if (Number.isNaN(since.getTime())) return { code: 1, output: `--since ${options.since}: give a date, 2026-10-13 or 2026-10-13T09:00` };
    const found = index.filter((l) => l.updated && new Date(l.updated) >= since && keep(l.id)).sort((a, b) => b.updated.localeCompare(a.updated));
    const text = [`${found.length} rules updated in Pega since ${options.since} (added and changed; removals and case types are not dated)`, ...found.map((l) => `~ ${l.id} — ${when(l)}`)].join('\n');
    return render(options, { since: options.since, rules: found.map(({ refs, ...l }) => l) }, text);
  }

  const sync = readSync(m);
  if (!sync) return { code: 1, output: 'no sync recorded yet in .pega/prev/: pega-ctx sync, or pega-ctx changes --since <date>' };
  const byId = new Map(index.map((l) => [l.id, l]));
  const before = new Map(readPreviousIndex(m).map((l) => [l.id, l]));
  const added = sync.added.filter(keep);
  const changed = sync.changed.filter(keep);
  const removed = sync.removed.filter(keep);
  const lines = [`last sync, ${sync.at.slice(0, 16).replace('T', ' ')}${sync.from ? ` (the one before: ${sync.from.slice(0, 16).replace('T', ' ')})` : ''}: ${added.length} added, ${changed.length} changed, ${removed.length} removed`];
  for (const id of added) lines.push(`+ ${id} — ${when(byId.get(id))}`);
  const diffs = {};
  for (const id of changed) {
    lines.push(`~ ${id} — ${when(byId.get(id))}`);
    diffs[id] = digestDiff(readPreviousDigest(m, id), m.readDigest(id), id);
    lines.push(...(diffs[id].length ? diffs[id] : ['    (same digest: a change the projection does not show; pega-ctx rule ' + id + ' --raw)']));
  }
  for (const id of removed) lines.push(`- ${id} — last seen ${when(before.get(id))}`);
  return render(options, { ...sync, added, changed, removed, diffs }, lines.join('\n'));
}
