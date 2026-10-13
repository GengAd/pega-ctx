// pega-ctx install: the agent kit per target, the merge of .claude/settings.json, the hook script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse, launch } from '../src/commands/index.mjs';
import { mergeSettings, PERMISSION } from '../src/commands/install.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const HOOK = join(import.meta.dirname, '..', 'templates', 'hooks', 'pega-ctx.mjs');

function tree(root) {
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(relative(root, p).split(sep).join('/'));
    }
  };
  walk(root);
  return files.sort();
}

async function install(line, root = mkdtempSync(join(tmpdir(), 'pega-ctx-'))) {
  const r = await launch(parse(line.split(' ')), { root });
  return { ...r, root };
}

const SKILLS = (base) => ['pega-morning', 'pega-story', 'pega-write'].map((s) => `${base}/${s}/SKILL.md`);

test('install --claude in an empty folder: the block, the skills, the agent, the drafts rule, the hook, the settings', async () => {
  const { code, output, root } = await install('install --claude');
  assert.equal(code, 0, output);
  assert.deepEqual(tree(root), [
    '.claude/agents/pega-explorer.md',
    '.claude/hooks/pega-ctx.mjs',
    '.claude/rules/pega-drafts.md',
    '.claude/settings.json',
    ...SKILLS('.claude/skills'),
    'CLAUDE.md',
  ].sort());
  assert.match(output.split('\n')[1], /^kit: \.claude\/skills\/pega-morning\/SKILL\.md, /);
  const agent = readFileSync(join(root, '.claude/agents/pega-explorer.md'), 'utf8');
  assert.match(agent, /^---\nname: pega-explorer\ndescription: .+\ntools: Bash\nhooks:\n {2}PreToolUse:\n {4}- matcher: "Bash"\n/);
  assert.match(agent, /args: \["\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/pega-ctx\.mjs", "explorer"\]\n---\n\nYou explore/);
  assert.match(readFileSync(join(root, '.claude/rules/pega-drafts.md'), 'utf8'), /^---\npaths:\n {2}- "\.pega\/drafts\/\*\*"\n---\n\n# pega-ctx drafts/);
  assert.match(readFileSync(join(root, '.claude/skills/pega-story/SKILL.md'), 'utf8'), /^---\nname: pega-story\ndescription: /);
  const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(settings.permissions.allow, [PERMISSION]);
  assert.deepEqual(settings.hooks.PreToolUse[0].hooks[0], { type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/pega-ctx.mjs', 'pre-tool-use'] });
  assert.deepEqual(settings.hooks.SessionStart[0].hooks[0].args.at(-1), 'session-start');
});

test('install --copilot: the block, the skills in .github/skills, the agent, the instructions for drafts', async () => {
  const { code, root } = await install('install --copilot');
  assert.equal(code, 0);
  assert.deepEqual(tree(root), [
    '.github/agents/pega-explorer.agent.md',
    '.github/copilot-instructions.md',
    '.github/instructions/pega-drafts.instructions.md',
    ...SKILLS('.github/skills'),
  ].sort());
  assert.match(readFileSync(join(root, '.github/agents/pega-explorer.agent.md'), 'utf8'), /^---\nname: pega-explorer\ndescription: .+\ntools: \['execute\/runInTerminal', 'execute\/getTerminalOutput'\]\n---\n/);
  assert.match(readFileSync(join(root, '.github/instructions/pega-drafts.instructions.md'), 'utf8'), /^---\ndescription: .+\napplyTo: "\.pega\/drafts\/\*\*"\n---\n/);
});

test('install for both: the skills once, in .claude/skills, which Copilot reads too; the brackets filled from the mirror', async () => {
  const { root } = await fixtureMirror();
  const { code } = await install('install', root);
  assert.equal(code, 0);
  const files = tree(root).filter((f) => !f.startsWith('.pega/'));
  assert.ok(files.includes('.claude/skills/pega-story/SKILL.md'));
  assert.ok(!files.some((f) => f.startsWith('.github/skills/')));
  assert.ok(files.includes('.github/agents/pega-explorer.agent.md'));
  assert.match(readFileSync(join(root, '.claude/skills/pega-story/SKILL.md'), 'utf8'), /\n# A user story on Test\n/);
});

test('settings: the earlier pega-ctx hooks replaced, the other entries kept, the permission once; a broken file left as it is', async () => {
  const before = {
    model: 'opus',
    permissions: { allow: ['Bash(npm test)', PERMISSION] },
    hooks: {
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: './guard.sh' }] },
        { matcher: 'Read', hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/pega-ctx.mjs', 'old'] }] },
      ],
    },
  };
  const after = JSON.parse(mergeSettings(JSON.stringify(before)));
  assert.equal(after.model, 'opus');
  assert.deepEqual(after.permissions.allow, ['Bash(npm test)', PERMISSION]);
  assert.equal(after.hooks.PreToolUse.length, 2);
  assert.equal(after.hooks.PreToolUse[0].hooks[0].command, './guard.sh');
  assert.equal(after.hooks.PreToolUse[1].hooks[0].args[1], 'pre-tool-use');
  assert.equal(mergeSettings(mergeSettings(JSON.stringify(before))), mergeSettings(JSON.stringify(before)), 'running again changes nothing');

  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  mkdirSync(join(root, '.claude'));
  writeFileSync(join(root, '.claude/settings.json'), '{ "hooks": ');
  const r = await install('install --claude', root);
  assert.equal(r.code, 1);
  assert.match(r.output.split('\n').at(-1), /^\.claude\/settings\.json is not valid JSON \(.+\): left as it is; add the permission Bash\(pega-ctx \*\)/);
  assert.equal(readFileSync(join(root, '.claude/settings.json'), 'utf8'), '{ "hooks": ');
});

const runHook = (mode, event) => spawnSync(process.execPath, [HOOK, mode], { input: JSON.stringify(event), encoding: 'utf8' });

test('hook pre-tool-use: the Pega MCP read tools and .pega/raw/ refused with what to run, the rest let through', () => {
  const refused = [
    { tool_name: 'mcp__plugin_pega-infinity-authoring_Pega_Infinity_Authoring__get-rule', tool_input: { key: 'X' } },
    { tool_name: 'mcp__pega__search-rules', tool_input: {} },
    { tool_name: 'Read', tool_input: { file_path: '/p/.pega/raw/View/A/B.toon' } },
    { tool_name: 'Read', tool_input: { file_path: 'C:\\p\\.pega\\raw\\View\\A\\B.toon' } },
    { tool_name: 'Grep', tool_input: { pattern: 'x', path: '.pega/raw' } },
    { tool_name: 'Bash', tool_input: { command: 'cat .pega/raw/Flow/A/B.toon' } },
  ];
  for (const event of refused) {
    const r = runHook('pre-tool-use', event);
    assert.equal(r.status, 2, JSON.stringify(event));
    assert.match(r.stderr, /^pega-ctx: .*pega-ctx rule <id>/);
  }
  const allowed = [
    { tool_name: 'mcp__plugin_pega-infinity-authoring_Pega_Infinity_Authoring__update-rule', tool_input: {} },
    { tool_name: 'Read', tool_input: { file_path: '.pega/digest/View/A/B.md' } },
    { tool_name: 'Bash', tool_input: { command: 'pega-ctx rule Flow:A:B --raw' } },
  ];
  for (const event of allowed) assert.equal(runHook('pre-tool-use', event).status, 0, JSON.stringify(event));
});

test('hook explorer: pega-ctx read commands only, one at a time, without --raw', () => {
  const bash = (command) => runHook('explorer', { tool_name: 'Bash', tool_input: { command } }).status;
  assert.equal(bash('pega-ctx around Flow:A:B --stage Collect'), 0);
  assert.equal(bash('pega-ctx search household --type View'), 0);
  for (const c of ['pega-ctx send Flow:A:B', 'pega-ctx rule X --raw', 'pega-ctx rule X | head', 'pega-ctx rule X; rm -rf .', 'cat .pega/index.jsonl', 'pega-ctx rule $(id)']) assert.equal(bash(c), 2, c);
});
