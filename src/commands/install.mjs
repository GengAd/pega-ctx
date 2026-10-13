// pega-ctx install [--claude] [--copilot]: writes the instructions from templates/ into the Pega project.
// Without an option, both. The block is delimited by markers: running again replaces it, an existing
// file without markers keeps its content and gets the block at the end. The brackets known from the
// mirror (application, version) are filled; the others stay to be completed.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mirror } from '../mirror/files.mjs';
import { render } from './common.mjs';

export const help = 'pega-ctx install [--claude] [--copilot]';
export const START = '<!-- pega-ctx:start -->';
export const END = '<!-- pega-ctx:end -->';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates');
const TARGETS = {
  claude: ['CLAUDE.md', 'CLAUDE.md'],
  copilot: ['copilot-instructions.md', '.github/copilot-instructions.md'],
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

export function run({ options, root }) {
  const chosen = Object.keys(TARGETS).filter((k) => options[k]);
  const known = values(root);
  const written = [];
  const remaining = new Set();
  for (const key of chosen.length ? chosen : Object.keys(TARGETS)) {
    const [template, target] = TARGETS[key];
    const block = fill(readFileSync(join(TEMPLATES, template), 'utf8'), known);
    for (const b of block.matchAll(/\[[^\]\n]+\]/g)) remaining.add(b[0].length > 40 ? `${b[0].slice(0, 40)}…]` : b[0]);
    const file = join(root, target);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, place(existsSync(file) ? readFileSync(file, 'utf8') : undefined, block));
    written.push(target);
  }
  const next = remaining.size ? `to complete by hand: ${[...remaining].join(', ')}` : 'nothing to complete';
  return render(options, { written, toComplete: [...remaining] }, `instructions written to ${written.join(', ')}; ${next}`);
}
