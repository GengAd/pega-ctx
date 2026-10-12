#!/usr/bin/env node
// Cost of a Claude Code session, read from its transcript (docs/measurement.md § What we measure: cost).
// Outside the pega-ctx CLI: only serves the measurement scenario.
//
//   node scripts/session-cost.mjs <session.jsonl | session id> [...] [--json] [--tools]
//
// A bare id is looked up in ~/.claude/projects/*/. The subagents' transcripts
// (<session>/subagents/*.jsonl) are counted with the session.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';

// $ per million tokens, Anthropic API prices as of 2026-10-06.
// Cache write: 1.25× the input (5 min duration), 2× (1 h duration). Cache read depends on the model.
const PRICES = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-fable-5': { input: 10, output: 50, cacheRead: 1 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

const args = process.argv.slice(2);
const json = args.includes('--json');
const perTool = args.includes('--tools');
const targets = args.filter((a) => !a.startsWith('--'));
if (!targets.length) {
  console.error('usage: node scripts/session-cost.mjs <session.jsonl | session id> [...] [--json] [--tools]');
  process.exit(1);
}

const results = targets.map((t) => measure(find(t)));
if (json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) show(r);
}

function find(target) {
  if (existsSync(target)) return target;
  const root = join(homedir(), '.claude/projects');
  for (const project of readdirSync(root)) {
    const f = join(root, project, `${target}.jsonl`);
    if (existsSync(f)) return f;
  }
  console.error(`transcript not found: ${target} (give the .jsonl path or the session id)`);
  process.exit(1);
}

function lines(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function measure(file) {
  const session = basename(file, '.jsonl');
  const subFolder = join(dirname(file), session, 'subagents');
  const subs = existsSync(subFolder)
    ? readdirSync(subFolder).filter((f) => f.endsWith('.jsonl')).map((f) => join(subFolder, f))
    : [];
  const main = lines(file);
  const all = [...main, ...subs.flatMap(lines)];

  // An API response is written over several lines (one block per line), same requestId:
  // the largest usage per field is kept.
  const responses = new Map();
  const tools = new Map();
  const nameOf = new Map();
  for (const l of all) {
    if (l.type !== 'assistant' || !l.message?.usage || l.message.model === '<synthetic>') continue;
    const key = l.requestId ?? l.message.id;
    const u = l.message.usage;
    const r = responses.get(key) ?? { model: l.message.model, fast: u.speed === 'fast', input: 0, write5m: 0, write1h: 0, read: 0, output: 0 };
    const written = u.cache_creation_input_tokens ?? 0;
    const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    r.input = Math.max(r.input, u.input_tokens ?? 0);
    r.write1h = Math.max(r.write1h, w1h);
    r.write5m = Math.max(r.write5m, written - w1h);
    r.read = Math.max(r.read, u.cache_read_input_tokens ?? 0);
    r.output = Math.max(r.output, u.output_tokens ?? 0);
    responses.set(key, r);
    for (const b of l.message.content ?? []) {
      if (b.type !== 'tool_use' || nameOf.has(b.id)) continue;
      nameOf.set(b.id, b.name);
      const t = tools.get(b.name) ?? { calls: 0, characters: 0 };
      t.calls++;
      tools.set(b.name, t);
    }
  }
  for (const l of all) {
    if (l.type !== 'user' || !Array.isArray(l.message?.content)) continue;
    for (const b of l.message.content) {
      if (b.type !== 'tool_result') continue;
      const t = tools.get(nameOf.get(b.tool_use_id) ?? '?') ?? { calls: 0, characters: 0 };
      t.characters += text(b.content).length;
      tools.set(nameOf.get(b.tool_use_id) ?? '?', t);
    }
  }

  const total = { input: 0, write5m: 0, write1h: 0, read: 0, output: 0, cost: 0 };
  const models = new Set();
  for (const r of responses.values()) {
    const price = PRICES[r.model];
    if (!price) {
      console.error(`unknown price for ${r.model}: add it to PRICES (scripts/session-cost.mjs)`);
      process.exit(1);
    }
    models.add(r.model);
    const f = r.fast ? 2 : 1;
    for (const k of ['input', 'write5m', 'write1h', 'read', 'output']) total[k] += r[k];
    total.cost += (f * (r.input * price.input + r.write5m * price.input * 1.25 + r.write1h * price.input * 2 + r.read * price.cacheRead + r.output * price.output)) / 1e6;
  }

  // A message sent in the session = one promptId; tool results share the turn's one.
  // Local commands (/model, /effort…) also have a promptId: they are left out.
  const prompts = new Map();
  for (const l of main) {
    if (l.type !== 'user' || !l.promptId || prompts.has(l.promptId)) continue;
    prompts.set(l.promptId, l);
  }
  const real = [...prompts.values()].filter((l) => !/^\s*<(local-command-|command-name>)/.test(text(l.message?.content)));
  const stamps = main.map((l) => l.timestamp).filter(Boolean).sort();
  // The duration starts at the first real prompt, not when the session opened.
  const start = real[0]?.timestamp ?? stamps[0];
  const end = stamps.at(-1);
  const calls = [...tools.values()].reduce((s, t) => s + t.calls, 0);
  const toolCharacters = [...tools.values()].reduce((s, t) => s + t.characters, 0);

  return {
    session,
    models: [...models],
    start,
    end,
    durationMin: start ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) : 0,
    requests: responses.size,
    subagents: subs.length,
    inputTokens: total.input + total.write5m + total.write1h + total.read,
    uncached: total.input,
    cacheWritten: total.write5m + total.write1h,
    cacheRead: total.read,
    outputTokens: total.output,
    costDollars: Math.round(total.cost * 100) / 100,
    toolCalls: calls,
    toolResultCharacters: toolCharacters,
    // A question asked by the session (AskUserQuestion) also waits for a human answer.
    nudges: Math.max(0, real.length - 1) + (tools.get('AskUserQuestion')?.calls ?? 0),
    tools: Object.fromEntries([...tools].sort((a, b) => b[1].characters - a[1].characters)),
  };
}

function text(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((c) => (c.type === 'text' ? c.text : c.type === 'image' ? '' : JSON.stringify(c))).join('\n');
}

function show(r) {
  const n = (x) => x.toLocaleString('en-US');
  console.log(`session ${r.session} (${r.models.join(', ')}), ${r.start} → ${r.end}, ${r.durationMin} min`);
  console.log(`  requests ${r.requests}${r.subagents ? `, of which subagents: ${r.subagents} transcripts` : ''}`);
  console.log(`  input ${n(r.inputTokens)} (uncached ${n(r.uncached)}, cache written ${n(r.cacheWritten)}, cache read ${n(r.cacheRead)}), output ${n(r.outputTokens)}`);
  console.log(`  cost ${r.costDollars.toFixed(2)} $, tool calls ${r.toolCalls}, tool results ${n(r.toolResultCharacters)} chars, nudges ${r.nudges}`);
  if (perTool) {
    for (const [name, t] of Object.entries(r.tools)) console.log(`    ${name}: ${t.calls} calls, ${n(t.characters)} chars`);
  }
  // Row of the "Results" table of docs/measurement.md, without the run, the scorecard or "case runs".
  console.log(`  | | ${r.inputTokens} | ${r.cacheRead} | ${r.outputTokens} | ${r.costDollars.toFixed(2)} | ${r.toolCalls} | ${r.nudges} | | |`);
}
