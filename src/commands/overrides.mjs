// pega-ctx overrides: the rules of the current application that mask a rule of a lower layer of the
// stack, same type and name, same class or parent class. Pega resolves; pega-ctx shows (docs/decisions/0004).
import { mirror } from '../mirror/files.mjs';
import { applicationOrder, rulesetOwners } from '../mirror/stack.mjs';
import { baseRuleset } from '../mirror/write.mjs';
import { isParentClass } from '../projection/common.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx overrides';

export function run({ options, root }) {
  const m = mirror(root);
  const config = m.readConfig();
  const data = m.readStackData();
  const text = m.readStack() ?? '';
  const current = data?.application ?? config.application;
  if (!current) return { code: 1, output: 'current application unknown: run pega-ctx sync' };
  const order = applicationOrder(data, text);
  const owners = rulesetOwners(data, text);
  const lower = (app) => order.includes(app) && order.indexOf(app) > order.indexOf(current);
  const index = m.readIndex();
  const found = [];
  for (const r of index.filter((x) => x.application === current)) {
    // Same class: the versions of other applications are on the same index line.
    const masked = (r.rulesets ?? []).filter((rs) => lower(owners.get(baseRuleset(rs))));
    if (masked.length) found.push({ id: r.id, masks: r.id, application: owners.get(baseRuleset(masked[0])), rulesets: masked });
    // Parent class: another line of a lower layer.
    for (const o of index) {
      if (o.id === r.id || o.type !== r.type || o.name !== r.name || !isParentClass(o.class, r.class) || !lower(o.application)) continue;
      found.push({ id: r.id, masks: o.id, application: o.application, rulesets: o.rulesets ?? [] });
    }
  }
  const lines = [
    `## Overrides in ${current}`,
    'rules of the current application that mask a rule of a lower layer (same type and name, same or parent class)',
    ...(found.length
      ? found.map((f) => (f.masks === f.id ? `- ${f.id} masks its own version in [${f.application}] ${f.rulesets.join(', ')}` : `- ${f.id} masks [${f.application}] ${f.masks}`))
      : [`none in the mirror${order.length > 1 ? '' : ': the stack read has one application, pega-ctx sync climbs it'}`]),
  ];
  return render(options, { application: current, overrides: found }, lines.join('\n'));
}
