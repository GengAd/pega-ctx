// doctor, on simulated machines: nothing of the real environment is read, no Java is launched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, launch } from '../src/commands/index.mjs';
import { javaMajor } from '../src/commands/doctor.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { fakePega } from './fake-pega.mjs';

const CONFIG = JSON.stringify({ pega_base_url: 'https://serveur.exemple', pega_oauth_client_id: '123', pega_infinity_version: '26-1' });

// A machine where everything is in place; each test breaks one point.
function machine(changes = {}) {
  return {
    node: () => '22.3.0',
    java: () => 'openjdk version "17.0.2" 2022-01-18\nOpenJDK Runtime Environment',
    plugin: () => '/plugins/pega/0.1.7',
    command: () => ({ command: 'java', args: [], env: { PEGA_SKILLS_PATH: '/plugins/pega/0.1.7/resources' } }),
    configFile: () => '/home/dev/.infinity-rules-mcp/config.json',
    readFile: () => CONFIG,
    skills: () => '/plugins/pega/0.1.7/resources/26-1/skills',
    exists: () => true,
    now: () => Date.parse('2026-10-13T10:00:00Z'),
    ...changes,
  };
}

async function doctor(line, { probe = machine(), connect = async () => fakePega(), root = mkdtempSync(join(tmpdir(), 'pega-ctx-')), timeout } = {}) {
  return launch(parse(line.split(' ')), { root, connect, probe, timeout });
}

test('doctor: everything in place, one ok line per point, then the connection', async () => {
  const r = await doctor('doctor');
  assert.equal(r.code, 0);
  assert.deepEqual(r.output.split('\n'), [
    'doctor: no problem',
    'ok    Node 22.3.0',
    'ok    Java 17',
    'ok    Pega plugin: /plugins/pega/0.1.7',
    'ok    server config: https://serveur.exemple, Infinity 26-1',
    'ok    schemas for Infinity 26-1',
    'note  no .pega/ here: pega-ctx init (from the project root)',
    'ok    connected: Test 01.01.01, PegaRULES 8, Gameboard 01.01.01',
  ]);
});

test('doctor: each problem says what to do, non-zero code, no connection tried', async () => {
  let connected = false;
  const r = await doctor('doctor', {
    probe: machine({ node: () => '18.19.0', java: () => 'java version "1.8.0_281"', readFile: () => '{"pega_base_url": "https://serveur.exemple/prweb", "pega_oauth_client_id": "1", "pega_infinity_version": "26-1"}', exists: () => false }),
    connect: async () => {
      connected = true;
      return fakePega();
    },
  });
  assert.equal(r.code, 1);
  assert.equal(connected, false);
  const lines = r.output.split('\n');
  assert.equal(lines[0], 'doctor: 3 problems');
  assert.match(r.output, /\nproblem {2}Node 18\.19\.0: pega-ctx needs Node 20 or later/);
  assert.match(r.output, /\nproblem {2}Java 8: the Pega MCP server needs Java 17 or later/);
  assert.match(r.output, /\nproblem {2}\/home\/dev\/\.infinity-rules-mcp\/config\.json: pega_base_url ends with \/prweb: give the server's root/);
  assert.match(r.output, /\nnote {5}no Pega session in this folder yet: the first connection opens the browser/);
  assert.equal(lines.at(-1), 'note     connection not tried: fix the problems above first');
});

test('doctor: no Java, no plugin, no or broken config, missing keys', async () => {
  const none = await doctor('doctor --offline', {
    probe: machine({ java: () => null, plugin: () => { throw new Error('Pega plugin not found in /x: install pega-infinity-authoring'); }, readFile: () => undefined }),
  });
  assert.match(none.output, /^doctor: 3 problems\n/);
  assert.match(none.output, /\nproblem {2}Java not found: install Java 17 or later/);
  assert.match(none.output, /\nproblem {2}Pega plugin not found in \/x/);
  assert.match(none.output, /\nproblem {2}no \/home\/dev\/\.infinity-rules-mcp\/config\.json: run the Pega plugin's setup/);
  // Without the plugin, the schemas are not looked for.
  assert.ok(!none.output.includes('schemas'));
  const broken = await doctor('doctor --offline', { probe: machine({ readFile: () => '{ "pega_base_url": ' }) });
  assert.match(broken.output, /\nproblem {2}\/home\/dev\/\.infinity-rules-mcp\/config\.json is not valid JSON/);
  const partial = await doctor('doctor --offline', { probe: machine({ readFile: () => '{"pega_base_url": "https://s"}' }) });
  assert.match(partial.output, /config\.json: pega_oauth_client_id, pega_infinity_version missing/);
  const schemas = await doctor('doctor --offline', { probe: machine({ skills: () => { throw new Error('no skills for Infinity 26-1 in /r: check pega_infinity_version'); } }) });
  assert.match(schemas.output, /\nproblem {2}no skills for Infinity 26-1/);
});

test('doctor: the mirror and its last sync', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  const m = mirror(root);
  m.writeConfig({ lastSync: null });
  assert.match((await doctor('doctor --offline', { root })).output, /\nnote {2}\.pega\/ never synced: pega-ctx sync$/);
  m.writeConfig({ lastSync: '2026-10-10T08:00:00.000Z' });
  assert.match((await doctor('doctor --offline', { root })).output, /\nnote {2}\.pega\/ synced 3 days ago \(2026-10-10\): pega-ctx sync$/);
  m.writeConfig({ lastSync: '2026-10-13T08:00:00.000Z' });
  const fresh = await doctor('doctor --offline', { root });
  assert.equal(fresh.code, 0);
  assert.match(fresh.output, /\nok {2}\.pega\/ synced on 2026-10-13 08:00$/);
});

test('doctor: a refused session, a sign-in still waiting', async () => {
  const refused = await doctor('doctor', {
    connect: async () => ({ ...fakePega(), applications: async () => { throw Object.assign(new Error('list-available-applications: 401'), { text: '401 Unauthorized: invalid token' }); } }),
  });
  assert.equal(refused.code, 1);
  assert.match(refused.output, /\nproblem {2}Pega refused the session \(401 Unauthorized: invalid token\): delete \.infinity-rules-mcp\/ in this folder/);
  const waiting = await doctor('doctor', { timeout: 20, connect: async () => ({ ...fakePega(), applications: () => new Promise(() => {}) }) });
  assert.equal(waiting.code, 1);
  assert.match(waiting.output, /\nproblem {2}no answer from Pega within 0\.02 s: the server is probably waiting for the sign-in/);
});

test('javaMajor: the new and the old version formats', () => {
  assert.equal(javaMajor('openjdk version "21.0.1" 2023-10-17'), 21);
  assert.equal(javaMajor('java version "1.8.0_281"'), 8);
  assert.equal(javaMajor('openjdk version "25" 2025-09-16'), 25);
  assert.equal(javaMajor('nothing'), null);
});

test('init: a server that does not start comes with what doctor finds offline', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  const r = await launch(parse(['init']), {
    root,
    probe: machine({ java: () => null }),
    connect: async () => { throw new Error('Pega MCP unreachable (spawn java ENOENT): check java -version (17+) and ~/.infinity-rules-mcp/config.json'); },
  });
  assert.equal(r.code, 1);
  assert.deepEqual(r.output.split('\n'), [
    'Pega MCP unreachable (spawn java ENOENT): check java -version (17+) and ~/.infinity-rules-mcp/config.json',
    'problem  Java not found: install Java 17 or later and put it on the PATH (java -version)',
  ]);
  const fine = await launch(parse(['init']), { root, probe: machine(), connect: async () => { throw new Error('Pega MCP unreachable (timeout)'); } });
  assert.equal(fine.output, 'Pega MCP unreachable (timeout)\npega-ctx doctor checks the rest');
});
