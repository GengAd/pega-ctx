#!/usr/bin/env node
// Project guardrails: a single dependency, OAuth tokens never read.
// Exit 2 = blocked (PreToolUse) or reported to the model (PostToolUse), message on stderr.
// The raw text of the Bash command is inspected: to test this hook, write the cases
// in a separate script (scratchpad) and run the script, otherwise the test command itself is blocked.
import { readFileSync } from 'node:fs';

const ONLY = '@modelcontextprotocol/sdk';
const input = JSON.parse(readFileSync(0, 'utf8'));
const { tool_name: tool, tool_input: args = {} } = input;

function refuse(message) {
  process.stderr.write(message + '\n');
  process.exit(2);
}

if (tool === 'Bash') {
  const cmd = args.command ?? '';
  if (/oauth-session\.json/.test(cmd)) {
    refuse('OAuth tokens: do not read .infinity-rules-mcp/oauth-session.json. For the connection, see ~/.infinity-rules-mcp/config.json or /pega-infinity-authoring:pega-setup.');
  }
  const m = cmd.match(/\b(?:npm\s+(?:i|install|add)|pnpm\s+add|yarn\s+add)\s+([^;&|\n]+)/);
  if (m) {
    const packages = m[1].split(/\s+/).filter((a) => a && !a.startsWith('-') && !/^\d*[<>]/.test(a));
    const others = packages.filter((p) => p.replace(/(.)@[^/]*$/, '$1') !== ONLY);
    if (others.length) {
      refuse(`A single dependency is allowed (${ONLY}): ${others.join(', ')} refused. Write the code with Node's standard library.`);
    }
  }
}

if ((tool === 'Write' || tool === 'Edit') && /(^|\/)package\.json$/.test(args.file_path ?? '')) {
  const pkg = JSON.parse(readFileSync(args.file_path, 'utf8'));
  const fields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  const others = fields.flatMap((c) => Object.keys(pkg[c] ?? {})).filter((n) => n !== ONLY);
  if (others.length) {
    refuse(`package.json: ${others.join(', ')} not allowed. Remove them, only ${ONLY} is permitted.`);
  }
}
