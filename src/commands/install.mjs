// pega-ctx install [--claude] [--copilot]: writes the instructions and the agent kit from templates/ into
// the Pega project. Without an option, both. One source in templates/, rendered per target:
// - instructions: a block in CLAUDE.md / .github/copilot-instructions.md, delimited by markers: running
//   again replaces it, an existing file without markers keeps its content and gets the block at the end;
// - skills, the pega-explorer agent, the drafts rule (and for Claude Code the hook script): files of their
//   own, rewritten by each install;
// - Claude Code: .claude/settings.json merged, its other entries kept.
// The brackets known from the mirror (application, version) are filled; the others stay to be completed.
// Formats and sources: docs/kit.md.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mirror } from '../mirror/files.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx install [--claude] [--copilot]';
export const START = '<!-- pega-ctx:start -->';
export const END = '<!-- pega-ctx:end -->';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates');
const HOOK = '.claude/hooks/pega-ctx.mjs';
const HOOK_ARG = '${CLAUDE_PROJECT_DIR}/' + HOOK;

const EXPLORER = 'Explores the .pega/ mirror of the Pega application with pega-ctx read commands and returns the relevant rules and a plan. Use for the context of a story, to keep the digests out of the main conversation.';
const DRAFTS = 'How to correct a pega-ctx draft before it is sent to Pega.';

// What Claude Code runs: the read tools of the Pega MCP and the reads of .pega/raw/ are refused, the session
// starts with pega-ctx check. Exec form (command + args): no shell, the same on Windows.
const hook = (mode) => ({ type: 'command', command: 'node', args: [HOOK_ARG, mode] });
export const CLAUDE_HOOKS = {
  PreToolUse: { matcher: '^(Read|Grep|Glob|Bash)$|^mcp__.*__(get-rule|get-rule-resolve-handle|list-rules|search-rules)$', hooks: [hook('pre-tool-use')] },
  SessionStart: { hooks: [hook('session-start')] },
};
export const PERMISSION = 'Bash(pega-ctx *)';

const frontmatter = (fields) => `---\n${fields.join('\n')}\n---\n\n`;

// Every file of the kit for a target: [path in the project, content]. `skills`: false when another target
// already writes them where this one reads them (Copilot reads .claude/skills/).
function kit(target, { skills = true } = {}) {
  const read = (...p) => readFileSync(join(TEMPLATES, ...p), 'utf8');
  const files = [];
  const skillRoot = target === 'claude' ? '.claude/skills' : '.github/skills';
  if (skills) for (const name of readdirSync(join(TEMPLATES, 'skills')).sort()) files.push([`${skillRoot}/${name}/SKILL.md`, read('skills', name, 'SKILL.md')]);
  const explorer = read('agents', 'pega-explorer.md');
  const drafts = read('rules', 'pega-drafts.md');
  if (target === 'claude') {
    files.push(['.claude/agents/pega-explorer.md', frontmatter([
      'name: pega-explorer',
      `description: ${EXPLORER}`,
      'tools: Bash',
      'hooks:',
      '  PreToolUse:',
      '    - matcher: "Bash"',
      '      hooks:',
      '        - type: command',
      '          command: node',
      `          args: ["${HOOK_ARG}", "explorer"]`,
    ]) + explorer]);
    files.push(['.claude/rules/pega-drafts.md', frontmatter(['paths:', '  - ".pega/drafts/**"']) + drafts]);
    files.push([HOOK, read('hooks', 'pega-ctx.mjs')]);
  } else {
    files.push(['.github/agents/pega-explorer.agent.md', frontmatter(['name: pega-explorer', `description: ${EXPLORER}`, "tools: ['execute/runInTerminal', 'execute/getTerminalOutput']"]) + explorer]);
    files.push(['.github/instructions/pega-drafts.instructions.md', frontmatter([`description: ${DRAFTS}`, 'applyTo: ".pega/drafts/**"']) + drafts]);
  }
  return files;
}

const TARGETS = {
  claude: { template: 'CLAUDE.md', file: 'CLAUDE.md' },
  copilot: { template: 'copilot-instructions.md', file: '.github/copilot-instructions.md' },
};

// Values known from the mirror, if it exists.
function values(root) {
  const m = mirror(root);
  if (!m.exists()) return {};
  const config = m.readConfig();
  const version = /^application: \S+ (\S+)/m.exec(m.readStack() ?? '')?.[1];
  return {
    '[Pega application name]': config.application,
    '[version]': version,
  };
}

export function fill(template, known) {
  let text = template;
  for (const [bracket, value] of Object.entries(known)) if (value) text = text.replaceAll(bracket, value);
  return text;
}

export function place(current, block) {
  const framed = `${START}\n${block.trimEnd()}\n${END}\n`;
  if (current === undefined) return framed;
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start !== -1 && end > start) return current.slice(0, start) + framed + current.slice(end + END.length).replace(/^\n/, '');
  return `${current.trimEnd()}\n\n${framed}`;
}

const ours = (entry) => JSON.stringify(entry ?? {}).includes(HOOK);

// .claude/settings.json with the permission and the hooks of pega-ctx, replacing the earlier ones,
// every other entry kept. Throws on a file that is not JSON: it is left as it is.
export function mergeSettings(text) {
  const settings = text === undefined ? {} : JSON.parse(text);
  settings.permissions ??= {};
  settings.permissions.allow ??= [];
  if (!settings.permissions.allow.includes(PERMISSION)) settings.permissions.allow.push(PERMISSION);
  settings.hooks ??= {};
  for (const [event, entry] of Object.entries(CLAUDE_HOOKS)) {
    settings.hooks[event] = [...(settings.hooks[event] ?? []).filter((e) => !ours(e)), entry];
  }
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function run({ options, root }) {
  const chosen = Object.keys(TARGETS).filter((k) => options[k]);
  const targets = chosen.length ? chosen : Object.keys(TARGETS);
  const known = values(root);
  const written = [];
  const kitFiles = [];
  const remaining = new Set();
  const problems = [];
  const note = (text) => {
    for (const b of text.matchAll(/\[[^\]\n]+\]/g)) remaining.add(b[0].length > 40 ? `${b[0].slice(0, 40)}…]` : b[0]);
  };
  const write = (target, text) => {
    const file = join(root, target);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  for (const key of targets) {
    const { template, file } = TARGETS[key];
    const block = fill(readFileSync(join(TEMPLATES, template), 'utf8'), known);
    note(block);
    const current = join(root, file);
    write(file, place(existsSync(current) ? readFileSync(current, 'utf8') : undefined, block));
    written.push(file);
    for (const [path, content] of kit(key, { skills: !(key === 'copilot' && targets.includes('claude')) })) {
      const text = path.endsWith('.md') ? fill(content, known) : content;
      if (path.endsWith('.md')) note(text);
      write(path, text);
      kitFiles.push(path);
    }
    if (key === 'claude') {
      const file = join(root, '.claude', 'settings.json');
      try {
        write('.claude/settings.json', mergeSettings(existsSync(file) ? readFileSync(file, 'utf8') : undefined));
        kitFiles.push('.claude/settings.json');
      } catch (e) {
        problems.push(`.claude/settings.json is not valid JSON (${e.message}): left as it is; add the permission ${PERMISSION} and the hooks of docs/kit.md by hand, or correct it and run pega-ctx install --claude again`);
      }
    }
  }
  const next = remaining.size ? `to complete by hand: ${[...remaining].join(', ')}` : 'nothing to complete';
  const text = [`instructions written to ${written.join(', ')}; ${next}`, `kit: ${kitFiles.join(', ')}`, ...problems].join('\n');
  return { ...render(options, { written, kit: kitFiles, toComplete: [...remaining], problems }, text), code: problems.length ? 1 : 0 };
}
