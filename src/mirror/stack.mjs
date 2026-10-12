// stack.md: the application, its rulesets, its built-on applications, in resolution order, then the
// rulesets seen in the mirror. stack() only reads the first level and does not say which ruleset is
// unlocked (docs/mcp-tools.md): the write ruleset depends on the class (src/mirror/write.mjs).
import { rulesetsSeen } from './write.mjs';

// s: the result of stack(); index: the mirror's index (empty right after init); write: the config's table.
export function renderStack(s, { index = [], write } = {}) {
  const own = new Set(s.rulesets);
  const seen = rulesetsSeen(index);
  const entries = write?.byClass?.length ?? 0;
  const owner = (name) => (own.has(name) ? s.application : 'a built-on application (the server does not say which)');
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
    'First level only: get-application cannot read applications outside the operator. Complete by hand beyond.',
    '',
    '## Rulesets seen in the mirror',
    ...(seen.length
      ? seen.map((r) => `- ${r.name}${r.version ? `:${r.version}` : ''}, ${owner(r.name)}: ${r.rules} rules, classes ${listClasses(r.classes)}`)
      : ['none yet: pega-ctx sync']),
    '',
  ].join('\n');
}
