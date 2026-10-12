#!/usr/bin/env node
// End of a measurement run (docs/measurement.md): cost, scorecard, table row, reset.
// Outside the pega-ctx CLI: only serves the measurement scenario.
//
//   node scripts/trial.mjs <A1|B1|A2…> --folder <run folder> [--ref <copy of .pega for B>] [--no-case]
//
// Run from the repository root (OAuth session of the scorecard). The branch is MES<A|B><n>.
// - cost: the most recent transcript of the folder (~/.claude/projects/<folder>/);
// - scorecard: the run's branch, since the session's first prompt;
// - the detail (tools, scorecard) goes to <folder>/../results/<run>.json, outside the repository: it carries
//   the application's real names;
// - the row of the "Results" table is filled, points 7 and 8 left to score;
// - reset: Claude Code memory of both folders emptied; for B, .pega/ restored from --ref.
// What remains to do in Pega (deleting the branch) is printed at the end: no MCP tool does it.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, rmSync, cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const run = args[0];
const folder = option('--folder') && resolve(option('--folder'));
if (!/^[AB][1-9]$/.test(run ?? '') || !folder) {
  console.error('usage: node scripts/trial.mjs <A1|B1|…> --folder <run folder> [--ref <copy of .pega>] [--no-case]');
  process.exit(1);
}
const ref = option('--ref') && resolve(option('--ref'));
if (run.startsWith('B') && !ref) {
  console.error('run B: --ref <copy of .pega made before B1> required, to restore the mirror');
  process.exit(1);
}
const branch = `MES${run}`;
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const projects = join(homedir(), '.claude/projects');
const projectFolder = (d) => join(projects, d.replace(/[/.]/g, '-'));

// 1. Cost.
const transcripts = readdirSync(projectFolder(folder))
  .filter((f) => f.endsWith('.jsonl'))
  .map((f) => join(projectFolder(folder), f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (!transcripts.length) throw new Error(`no session in ${projectFolder(folder)}`);
const node = (script, ...a) => execFileSync(process.execPath, [join(repo, 'scripts', script), ...a], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26 });
const [cost] = JSON.parse(node('session-cost.mjs', transcripts[0], '--json'));
console.log(`session ${cost.session} (${cost.models.join(', ')}), ${cost.durationMin} min, ${cost.costDollars} $, ${cost.nudges} nudges`);

// 2. Scorecard.
const card = JSON.parse(node('scorecard.mjs', branch, '--since', cost.start, '--json', ...(args.includes('--no-case') ? ['--no-case'] : [])));
for (const p of card.points) console.log(`${p.n}. ${p.ok === true ? '✓' : p.ok === false ? '✗' : '?'} ${p.detail}`);
const auto = card.points.filter((p) => p.ok === true).length;
const runs = card.points.find((p) => p.n === 6)?.ok;

// 3. Detail outside the repository, table row inside it.
const results = join(dirname(folder), 'results');
mkdirSync(results, { recursive: true });
writeFileSync(join(results, `${run}.json`), JSON.stringify({ run, branch, transcript: transcripts[0], cost, scorecard: card }, null, 2));
const scenario = join(repo, 'docs/measurement.md');
const text = readFileSync(scenario, 'utf8');
const row = `| ${run} | ${cost.inputTokens} | ${cost.cacheRead} | ${cost.outputTokens} | ${cost.costDollars.toFixed(2)} | ${cost.toolCalls} | ${cost.nudges} | ${auto}/6 + ?/2 | ${runs === true ? 'yes' : runs === false ? 'no' : '?'} |`;
const pattern = new RegExp(`^\\| ${run} \\|.*$`, 'm');
if (!pattern.test(text)) throw new Error(`row ${run} missing from the Results table of docs/measurement.md`);
writeFileSync(scenario, text.replace(pattern, row));
console.log(`\ntable: ${row}`);

// 4. Reset.
// The run folders are siblings (mesure-a, mesure-b): each one's memory is emptied.
for (const name of readdirSync(dirname(folder))) {
  const d = join(dirname(folder), name);
  if (statSync(d).isDirectory()) rmSync(join(projectFolder(d), 'memory'), { recursive: true, force: true });
}
if (run.startsWith('B')) {
  rmSync(join(folder, '.pega'), { recursive: true, force: true });
  cpSync(ref, join(folder, '.pega'), { recursive: true });
  console.log(`B mirror restored from ${ref}`);
}
console.log(`Claude Code memory emptied\n\nTo do in Pega: delete branch ${branch} (rules and the scorecard's case included).`);
