// pega-ctx examples [Type]: the server's examples, templates for a type the application has no rule of
// yet (pega-ctx create <Type> <Class> <Name> --from example:<name>). Without a type: the writable types
// and their number of examples.
import { WRITABLE } from '../mcp/types.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx examples [Type]';

export function run({ positionals, options, examples }) {
  const [type] = positionals;
  if (!type) {
    const rows = WRITABLE.map((w) => {
      let n;
      try {
        n = examples.list(w.type).length;
      } catch (e) {
        return { type: w.type, ruleClass: w.ruleClass, error: e.message };
      }
      return { type: w.type, ruleClass: w.ruleClass, examples: n };
    });
    const failed = rows.find((r) => r.error);
    if (failed) return { code: 1, output: failed.error };
    const text = rows.map((r) => `${r.type} (${r.ruleClass}): ${r.examples} example${r.examples === 1 ? '' : 's'}`).join('\n');
    return render(options, rows, `${text}\n\npega-ctx examples <Type> lists them`);
  }
  const list = examples.list(type);
  if (!list.length) return { code: 1, output: `no example for ${type} in the Pega plugin: start from a sibling rule (pega-ctx search)` };
  const text = list.map((e) => `- ${e.name}: ${e.label}${e.description ? ` — ${e.description}` : ''}`).join('\n');
  return render(options, list, `${text}\n\npega-ctx create ${type} <Class> <Name> --from example:${list[0].name} --draft`);
}
