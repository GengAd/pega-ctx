// pega-ctx init [--ruleset A,B] [--ignore-raw] [--force]: creates .pega/config.json and stack.md.
// Followed rulesets: --ruleset, otherwise those of the current application (stack()).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mirror } from '../mirror/files.mjs';
import { renderStack } from '../mirror/stack.mjs';
import { listOption } from './common.mjs';

export const help = 'pega-ctx init [--ruleset A,B] [--ignore-raw] [--force]';

export async function run({ options, root, connect }) {
  const m = mirror(root);
  if (m.exists() && !options.force) {
    return { code: 1, output: 'mirror already in .pega/: pega-ctx sync to update it, or init --force to recreate it' };
  }
  const pega = await connect();
  let stack;
  try {
    stack = await pega.stack();
  } catch (e) {
    if (!options.ruleset) return { code: 1, output: `stack() failed (${e.message}): run again with --ruleset <Name,Name>` };
  } finally {
    await pega.close();
  }
  const rulesets = options.ruleset ? listOption(options.ruleset) : stack.rulesets;
  // The MCP command is read again from the Pega plugin at each launch: a fixed path would break
  // at the next plugin update.
  // write: where new rules go, by class prefix (first match wins); sync drafts it in .pega/write.draft.json.
  m.writeConfig({ mcp: { source: 'plugin' }, application: stack?.application, rulesets, write: { byClass: [], default: null }, branch: null, lastSync: null });
  if (stack) m.writeStack(renderStack(stack, { previous: m.readStack() ?? '' }));

  if (options['ignore-raw']) {
    const gitignore = join(root, '.gitignore');
    const current = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : '';
    if (!current.split('\n').includes('.pega/raw/')) writeFileSync(gitignore, `${current}${current && !current.endsWith('\n') ? '\n' : ''}.pega/raw/\n`);
  }
  return { code: 0, output: `mirror created in .pega/, followed rulesets: ${rulesets.join(', ')}. Next: pega-ctx sync` };
}
