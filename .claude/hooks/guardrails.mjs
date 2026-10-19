#!/usr/bin/env node
// Project guardrails: a single dependency, OAuth tokens never read, pushes only to the public repository and clean.
// Exit 2 = blocked (PreToolUse) or reported to the model (PostToolUse), message on stderr.
// The raw text of the Bash command is inspected: to test this hook, write the cases
// in a separate script (scratchpad) and run the script, otherwise the test command itself is blocked.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ONLY = '@modelcontextprotocol/sdk';
const PUBLIC_REMOTE = 'realOrigin';
const ALLOWED_EMAILS = ['noreply@anthropic.com'];
const input = JSON.parse(readFileSync(0, 'utf8'));
const { tool_name: tool, tool_input: args = {} } = input;

function refuse(message) {
  process.stderr.write(message + '\n');
  process.exit(2);
}

// Only `git push realOrigin main` (or `git push origin main` in a clone without a realOrigin remote,
// when origin is the public repository), and only when nothing it publishes (added lines, file names,
// commit messages) carries a real name of the anonymization table or an email address.
// A name found is reported by its pseudonym, never printed.
function checkPush(args) {
  const dir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const remotes = git('remote').split('\n').filter(Boolean);
  const originIsPublic = () => /github\.com[/:]GengAd\/pega-ctx(\.git)?$/i.test(git('remote', 'get-url', 'origin').trim());
  const fallback = !remotes.includes(PUBLIC_REMOTE) && remotes.includes('origin') && originIsPublic();
  const remote = args.join(' ') === `${PUBLIC_REMOTE} main` ? PUBLIC_REMOTE : fallback && args.join(' ') === 'origin main' ? 'origin' : undefined;
  if (!remote) {
    refuse(`Push: only \`git push ${PUBLIC_REMOTE} main\` (the public repository GengAd/pega-ctx; \`git push origin main\` when this clone has no ${PUBLIC_REMOTE} remote and origin is that repository), no other remote, branch or option.`);
  }
  const published = git('log', '-p', '--format=%B', `${remote}/main..HEAD`)
    .split('\n').filter((l) => !l.startsWith('-') && !l.startsWith(' ')).join('\n');
  const tablePath = join(dir, 'tests/fixture/anonymization.json');
  const table = existsSync(tablePath) ? JSON.parse(readFileSync(tablePath, 'utf8')) : {};
  const text = published.toLowerCase();
  const names = Object.entries(table).filter(([real]) => {
    const r = real.toLowerCase();
    return r.length >= 4 ? text.includes(r) : new RegExp(`\\b${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
  }).map(([, pseudonym]) => pseudonym);
  if (names.length) {
    refuse(`Push refused: the commits to publish carry the real name behind ${names.join(', ')} (anonymization table). Replace it with its pseudonym, rewrite the unpushed commits, then push.`);
  }
  const emails = [...new Set(published.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}\b/gi) ?? [])].filter((e) => !ALLOWED_EMAILS.includes(e));
  if (emails.length) {
    refuse(`Push refused: ${emails.length} email address(es) in the commits to publish. Remove them, rewrite the unpushed commits, then push.`);
  }
}

if (tool === 'Bash') {
  const cmd = args.command ?? '';
  if (/oauth-session\.json/.test(cmd)) {
    refuse('OAuth tokens: do not read .infinity-rules-mcp/oauth-session.json. For the connection, see ~/.infinity-rules-mcp/config.json or /pega-infinity-authoring:pega-setup.');
  }
  const push = cmd.match(/\bgit\s+(?:-C\s+\S+\s+)?push\b([^;&|\n]*)/);
  if (push) checkPush(push[1].trim().split(/\s+/).filter((a) => a && a !== '-q'));
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
