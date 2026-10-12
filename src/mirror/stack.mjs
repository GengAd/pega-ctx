// stack.md: the application, its built-on applications, the rulesets in resolution order, the
// built-on applications the user adds by hand, then the rulesets seen in the mirror. stack() climbs
// the application rules (docs/mcp-tools.md) but does not say which ruleset is unlocked: the write
// ruleset depends on the class (src/mirror/write.mjs).
import { rulesetsSeen, baseRuleset } from './write.mjs';

const MANUAL = '## Built on (manual)';
const MANUAL_HELP = 'none. For each built-on application pega-ctx cannot read, a line `- Application Version: Ruleset:Version, …`; sync keeps this section as it is.';
// A layer with more rulesets than this is shortened in the resolution order (PegaRULES has 61).
const LONG = 12;

// s: the result of stack(); index: the mirror's index (empty right after init); write: the config's table;
// previous: the stack.md being replaced, whose manual section is kept; followed: the applications of the
// config (undefined when the config names rulesets only).
export function renderStack(s, { index = [], write, previous = '', followed } = {}) {
  const manual = manualSection(previous);
  const owners = rulesetOwners(s, previous);
  const unread = (s.layers ?? []).filter((l) => l.error);
  const outside = !s.layers
    ? 'a built-on application (the server does not say which)'
    : `not in the application's stack${unread.length ? ` as read (${unread.map((l) => l.application).join(', ')} unread)` : ''}`;
  const owner = (name) => owners.get(name) ?? outside;
  const seen = rulesetsSeen(index);
  const entries = write?.byClass?.length ?? 0;
  const listClasses = (classes) => (classes.length > 4 ? `${classes.slice(0, 4).join(', ')}… (${classes.length})` : classes.join(', '));
  return [
    '# Stack',
    '',
    `application: ${s.application} ${s.version}${s.constellation ? ' (Constellation)' : ''}`,
    `rulesets: ${s.rulesets.join(', ') || 'none'}`,
    `write ruleset: depends on the class, pega-ctx stack --for <Class> says it (${entries ? `"write" table: ${entries} prefixes` : '"write" table empty: draft in .pega/write.draft.json'})`,
    '',
    '## Built on',
    ...(s.builtOn.length ? s.builtOn.map((b) => `- ${b.application} ${b.version}`) : ['none']),
    '',
    ...(s.layers ? resolutionOrder(s.layers, followed) : ['First level only: get-application cannot read applications outside the operator. Complete by hand beyond.', '']),
    MANUAL,
    ...manual.lines,
    '',
    '## Rulesets seen in the mirror',
    ...(seen.length
      ? seen.map((r) => `- ${r.name}${r.version ? `:${r.version}` : ''}, ${owner(r.name)}: ${r.rules} rules, classes ${listClasses(r.classes)}`)
      : ['none yet: pega-ctx sync']),
    '',
  ].join('\n');
}

function resolutionOrder(layers, followed) {
  const rulesets = (l) => (l.rulesets.length > LONG ? `${l.rulesets.length} rulesets, ${l.rulesets.slice(0, 3).join(', ')} … ${l.rulesets.at(-1)}` : l.rulesets.join(', ') || 'none');
  return [
    '## Resolution order',
    'Pega searches the rulesets in this order, application by application (each application rule\'s ruleset list, branches first).',
    ...layers.map((l, i) => `${i + 1}. ${l.application} ${l.version}${followed && !l.error && !followed.includes(l.application) ? ' (not mirrored)' : ''}: ${l.error ? `not read (${l.error}): add its rulesets under "${MANUAL}"` : rulesets(l)}`),
    '',
  ];
}

// Base ruleset → application: the current application's, then each layer the climb read, then the
// manual section of stack.md. s: stack() as saved in .pega/stack.json (null before the first sync).
export function rulesetOwners(s, stackText = '') {
  const owners = new Map();
  const own = (rulesets, application) => {
    for (const r of rulesets ?? []) if (!owners.has(baseRuleset(r))) owners.set(baseRuleset(r), application);
  };
  if (s) own(s.rulesets, s.application);
  for (const l of s?.layers ?? []) own(l.rulesets, l.application);
  for (const m of manualSection(stackText).entries) own(m.rulesets, m.application);
  return owners;
}

// Applications from the highest priority to the lowest: the climb's order, then the manual section's.
export function applicationOrder(s, stackText = '') {
  const order = [...new Set([s?.application, ...(s?.layers ?? []).map((l) => l.application), ...manualSection(stackText).entries.map((e) => e.application)].filter(Boolean))];
  return order;
}

// The index line with the application of its ruleset (the highest version's), when the stack knows it.
export function withApplication(line, owners) {
  const { application, ...rest } = line;
  const owner = owners.get(baseRuleset(line.rulesets?.[0]));
  return owner ? { ...rest, application: owner } : rest;
}

// The section the user fills, kept from the previous stack.md: its lines, and the entries read from them.
export function manualSection(text = '') {
  const start = text.indexOf(`\n${MANUAL}\n`);
  if (start < 0) return { lines: [MANUAL_HELP], entries: [] };
  const body = text.slice(start + MANUAL.length + 2);
  const end = body.search(/^## /m);
  const lines = (end < 0 ? body : body.slice(0, end)).replace(/\n+$/, '').split('\n');
  const entries = lines
    .map((l) => /^- (\S+) (\S+): (.+)$/.exec(l))
    .filter(Boolean)
    .map((m) => ({ application: m[1], version: m[2], rulesets: m[3].split(',').map((r) => r.trim()).filter(Boolean) }));
  return { lines: lines.length && lines.some((l) => l.trim()) ? lines : [MANUAL_HELP], entries };
}
