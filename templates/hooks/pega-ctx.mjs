#!/usr/bin/env node
// Claude Code hooks written by `pega-ctx install --claude`; rewritten by each install, do not edit.
//   pre-tool-use   refuses the Pega MCP read tools and reading .pega/raw/, and says what to run instead
//   explorer       the pega-explorer agent: only pega-ctx read commands, one at a time
//   session-start  pega-ctx check, whose lines join the session's context
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const mode = process.argv[2];

// The event Claude Code sends on stdin; {} if it cannot be read.
function input() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

// Exit 2: Claude Code refuses the call and gives the reason to the model.
function refuse(reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}

const READ_TOOLS = /__(get-rule|get-rule-resolve-handle|list-rules|search-rules)$/;
const RAW = /\.pega[\\/]+raw([\\/]|$)/;

function preToolUse({ tool_name: tool = '', tool_input: args = {} }) {
  if (tool.startsWith('mcp__') && READ_TOOLS.test(tool)) {
    refuse('pega-ctx: the Pega MCP read tools return the raw rule. Use pega-ctx search <words>, pega-ctx rule <id> (its digest), pega-ctx live <id> (read in Pega now), pega-ctx around <id>.');
  }
  const looked = [args.file_path, args.path, args.pattern, args.command].filter((v) => typeof v === 'string');
  if (looked.some((v) => RAW.test(v))) {
    refuse('pega-ctx: .pega/raw/ holds the raw rules, ten times longer than their digest. Use pega-ctx rule <id>, or pega-ctx rule <id> --raw for a field the digest does not show.');
  }
}

const EXPLORER = /^pega-ctx (search|rule|around|model|stack|check|overrides)( |$)/;

function explorer({ tool_name: tool = '', tool_input: args = {} }) {
  if (tool !== 'Bash') return;
  const command = String(args.command ?? '').trim();
  if (!EXPLORER.test(command) || /[;&|<>`$\n]/.test(command) || /--raw\b/.test(command)) {
    refuse('pega-explorer runs pega-ctx search, rule, around, model, stack, check or overrides, one command at a time, without --raw.');
  }
}

function sessionStart() {
  const r = spawnSync('pega-ctx', ['check'], { encoding: 'utf8', shell: process.platform === 'win32' });
  const out = `${r.stdout ?? ''}`.trim();
  if (r.error) process.stdout.write('pega-ctx not found on the PATH: the .pega/ mirror cannot be checked.\n');
  else if (out) process.stdout.write(`pega-ctx check:\n${out}\n`);
  process.exit(0);
}

if (mode === 'pre-tool-use') preToolUse(input());
else if (mode === 'explorer') explorer(input());
else if (mode === 'session-start') sessionStart();
process.exit(0);
