// pega-ctx stack [--for <Class>]: stack.md; with --for, the inheritance chain known from the index
// and where a new rule of this class is written.
import { mirror } from '../mirror/files.mjs';
import { inheritanceChain } from '../mirror/graph.mjs';
import { resolveWrite } from '../mirror/write.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx stack [--for <Class>]';

export function run({ options, root }) {
  const m = mirror(root);
  const config = m.readConfig();
  const stack = m.readStack();
  if (!stack) return { code: 1, output: 'no stack.md: run pega-ctx sync' };
  if (typeof options.for !== 'string') return render(options, { stack }, stack.trimEnd());

  const index = m.readIndex();
  const chain = inheritanceChain(index, options.for);
  const write = resolveWrite({ class: options.for, table: config.write, index });
  const writeLine = write.ruleset
    ? `write to: ${write.ruleset} (${write.source})`
    : write.reason === 'ambiguous'
      ? `write to: ambiguous, the class holds rules of ${write.candidates.join(', ')}: ask the user, then add the class to "write" in .pega/config.json`
      : `write to: unknown, no prefix of "write" in .pega/config.json and no rule of this class in the mirror: ask the user (draft: .pega/write.draft.json)`;
  const text = [
    stack.trimEnd(),
    '',
    `## Inheritance of ${options.for}`,
    'by name, classes present in the mirror; the Pega engine decides',
    ...(chain.length ? chain.map((c) => `- ${c}`) : ['no parent class in the mirror']),
    '',
    writeLine,
  ].join('\n');
  return render(options, { stack, class: options.for, inheritance: chain, write }, text);
}
