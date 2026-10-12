// pega-ctx search <words> [--type T] [--class C]: grep on index.jsonl, name and description,
// case-insensitive, every word must match. A hundred lines at most.
import { mirror } from '../mirror/files.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx search <words> [--type T] [--class C]';
const MAX = 100;

export function run({ positionals, options, root }) {
  if (!positionals.length) return { code: 1, output: 'no words: pega-ctx search <words> [--type T] [--class C]' };
  const m = mirror(root);
  m.readConfig();
  const words = positionals.map((w) => w.toLowerCase());
  const cls = typeof options.class === 'string' ? options.class.toLowerCase() : undefined;
  const found = m.readIndex().filter((r) => {
    if (typeof options.type === 'string' && r.type !== options.type) return false;
    if (cls && !r.class.toLowerCase().includes(cls)) return false;
    const text = `${r.name} ${r.description ?? ''}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
  const lines = found.slice(0, MAX).map((r) => `${r.id} — ${r.description || '(no description)'} — ${(r.rulesets ?? []).join(', ')}`);
  if (found.length > MAX) lines.push(`… and ${found.length - MAX} more, narrow with --type or --class`);
  if (!found.length) lines.push(`no rule for "${positionals.join(' ')}": try other words, or pega-ctx sync`);
  return render(options, found.map(({ refs, ...r }) => r), lines.join('\n'));
}
