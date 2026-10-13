// pega-ctx doctor [--offline]: what pega-ctx needs, checked one point per line (ok, problem, note);
// each problem says what to do. Non-zero code if there is a problem. --offline skips the connection.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mirror } from '../mirror/files.mjs';
import { pluginFolder, commandFromPlugin } from '../mcp/client.mjs';
import { skillsFolder } from '../mcp/schemas.mjs';

export const help = 'pega-ctx doctor [--offline]';

// The connection waits that long: without a valid session the server opens the browser and waits for the sign-in.
export const TIMEOUT = 90_000;
const KEYS = ['pega_base_url', 'pega_oauth_client_id', 'pega_infinity_version'];

// What doctor reads of the machine; the tests replace any of them.
export const probes = {
  node: () => process.versions.node,
  // java -version writes on stderr; null when java cannot be launched.
  java: () => {
    const r = spawnSync('java', ['-version'], { encoding: 'utf8' });
    return r.error ? null : `${r.stderr ?? ''}${r.stdout ?? ''}`;
  },
  plugin: () => pluginFolder(),
  command: (folder) => commandFromPlugin(folder),
  configFile: () => join(homedir(), '.infinity-rules-mcp', 'config.json'),
  readFile: (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined),
  skills: (skillsPath, version) => skillsFolder({ skillsPath, version }),
  exists: (path) => existsSync(path),
  now: () => Date.now(),
};

const ok = (text) => ({ status: 'ok', text });
const problem = (text) => ({ status: 'problem', text });
const note = (text) => ({ status: 'note', text });

// "17.0.2" → 17; "1.8.0_281" → 8.
export function javaMajor(text = '') {
  const m = /version "(\d+)(?:\.(\d+))?/.exec(text);
  if (!m) return null;
  return m[1] === '1' ? Number(m[2]) : Number(m[1]);
}

// Every point that needs no server, in the order a new user meets them.
export function offlineChecks(root, probe = probes) {
  const found = [];
  const node = probe.node();
  found.push(Number(node.split('.')[0]) >= 20 ? ok(`Node ${node}`) : problem(`Node ${node}: pega-ctx needs Node 20 or later (nodejs.org)`));

  const java = probe.java();
  const major = javaMajor(java ?? '');
  if (java === null) found.push(problem('Java not found: install Java 17 or later and put it on the PATH (java -version)'));
  else if (major === null || major < 17) found.push(problem(`Java ${major ?? '(unknown version)'}: the Pega MCP server needs Java 17 or later (java -version)`));
  else found.push(ok(`Java ${major}`));

  let command;
  try {
    const folder = probe.plugin();
    command = probe.command(folder);
    found.push(ok(`Pega plugin: ${folder}`));
  } catch (e) {
    found.push(problem(e.message));
  }

  const file = probe.configFile();
  const text = probe.readFile(file);
  let config;
  if (text === undefined) {
    found.push(problem(`no ${file}: run the Pega plugin's setup (pega-setup), or write it with ${KEYS.join(', ')} (README § Install)`));
  } else {
    try {
      config = JSON.parse(text);
    } catch (e) {
      found.push(problem(`${file} is not valid JSON (${e.message}): correct it`));
    }
  }
  if (config) {
    const missing = KEYS.filter((k) => typeof config[k] !== 'string' || !config[k]);
    if (missing.length) found.push(problem(`${file}: ${missing.join(', ')} missing`));
    else if (/\/prweb\/?$/.test(config.pega_base_url)) found.push(problem(`${file}: pega_base_url ends with /prweb: give the server's root, the Pega MCP adds /prweb`));
    else found.push(ok(`server config: ${config.pega_base_url}, Infinity ${config.pega_infinity_version}`));
  }

  if (command) {
    try {
      probe.skills(command.env.PEGA_SKILLS_PATH, config?.pega_infinity_version);
      found.push(ok(`schemas for Infinity ${config?.pega_infinity_version ?? '(highest version)'}`));
    } catch (e) {
      found.push(problem(e.message));
    }
  }

  // The server keeps its OAuth session in the folder it is launched from.
  if (!probe.exists(join(root, '.infinity-rules-mcp'))) found.push(note('no Pega session in this folder yet: the first connection opens the browser to sign in'));

  const m = mirror(root);
  if (!m.exists()) found.push(note('no .pega/ here: pega-ctx init (from the project root)'));
  else {
    const last = m.readConfig().lastSync;
    const days = last ? Math.floor((probe.now() - Date.parse(last)) / 86_400_000) : null;
    if (last === null || last === undefined) found.push(note('.pega/ never synced: pega-ctx sync'));
    else if (days >= 1) found.push(note(`.pega/ synced ${days} day${days > 1 ? 's' : ''} ago (${last.slice(0, 10)}): pega-ctx sync`));
    else found.push(ok(`.pega/ synced on ${last.slice(0, 16).replace('T', ' ')}`));
  }
  return found;
}

// The server launched and asked a light question that needs a signed-in session.
export async function connectionCheck(connect, timeout = TIMEOUT) {
  let pega;
  let timer;
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve('late'), timeout);
  });
  const ask = (async () => {
    pega = await connect();
    return pega.applications();
  })();
  ask.catch(() => {});
  try {
    const r = await Promise.race([ask, late]);
    if (r === 'late') return problem(`no answer from Pega within ${timeout / 1000} s: the server is probably waiting for the sign-in in the browser it opened; sign in, then run pega-ctx doctor again`);
    return ok(`connected: ${[...new Set(r.map((a) => `${a.application} ${a.version}`))].join(', ') || 'no application open to the operator'}`);
  } catch (e) {
    const text = String(e.text ?? e.message);
    if (/401|403|unauthori[sz]ed|token/i.test(text)) return problem(`Pega refused the session (${text.split('\n')[0].slice(0, 160)}): delete .infinity-rules-mcp/ in this folder and run pega-ctx doctor again to sign in`);
    return problem(`${text.split('\n')[0].slice(0, 200)}`);
  } finally {
    clearTimeout(timer);
    pega?.close().catch(() => {});
  }
}

export function report(found) {
  const problems = found.filter((f) => f.status === 'problem').length;
  const width = Math.max(...found.map((f) => f.status.length));
  const lines = found.map((f) => `${f.status.padEnd(width)}  ${f.text}`);
  return [`doctor: ${problems ? `${problems} problem${problems > 1 ? 's' : ''}` : 'no problem'}`, ...lines].join('\n');
}

export async function run({ options, root, connect, probe = probes, timeout = TIMEOUT }) {
  const all = { ...probes, ...probe };
  const found = offlineChecks(root, all);
  // A connection is only tried when nothing local already prevents it.
  if (!options.offline) {
    if (found.some((f) => f.status === 'problem')) found.push(note('connection not tried: fix the problems above first'));
    else found.push(await connectionCheck(connect, timeout));
  }
  const code = found.some((f) => f.status === 'problem') ? 1 : 0;
  return { code, output: options.json ? JSON.stringify(found, null, 2) : report(found) };
}
