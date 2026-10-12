// pega-ctx init [--all] [--ruleset A,B] [--ignore-raw] [--force]: creates .pega/config.json and stack.md.
// Followed: the applications of the stack except those Pega ships (--all: every one), whose rulesets sync
// finds itself; --ruleset A,B follows those rulesets only, as before.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mirror } from '../mirror/files.mjs';
import { renderStack } from '../mirror/stack.mjs';
import { shippedByPega } from '../mcp/tools.mjs';
import { listOption } from './common.mjs';

export const help = 'pega-ctx init [--all] [--ruleset A,B] [--ignore-raw] [--force]';

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
  const rulesets = options.ruleset ? listOption(options.ruleset) : [];
  const layers = stack?.layers ?? [];
  const applications = options.ruleset ? undefined : layers.length ? layers.filter((l) => !l.error && (options.all || !shippedByPega(l))).map((l) => l.application) : [stack.application];
  const left = options.ruleset ? [] : layers.filter((l) => !l.error && !applications.includes(l.application)).map((l) => l.application);
  // The MCP command is read again from the Pega plugin at each launch: a fixed path would break
  // at the next plugin update.
  // write: where new rules go, by class prefix (first match wins); sync drafts it in .pega/write.draft.json.
  m.writeConfig({ mcp: { source: 'plugin' }, application: stack?.application, ...(applications ? { applications } : {}), rulesets, write: { byClass: [], default: null }, branch: null, lastSync: null });
  if (stack) {
    m.writeStack(renderStack(stack, { previous: m.readStack() ?? '', followed: applications }));
    m.writeStackData(stack);
  }

  if (options['ignore-raw']) {
    const gitignore = join(root, '.gitignore');
    const current = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : '';
    if (!current.split('\n').includes('.pega/raw/')) writeFileSync(gitignore, `${current}${current && !current.endsWith('\n') ? '\n' : ''}.pega/raw/\n`);
  }
  const followedText = applications
    ? `followed applications: ${applications.join(', ')}${left.length ? ` (shipped by Pega, not followed: ${left.join(', ')}; --all follows them)` : ''}`
    : `followed rulesets: ${rulesets.join(', ')}`;
  return { code: 0, output: `mirror created in .pega/, ${followedText}. Next: pega-ctx sync` };
}
