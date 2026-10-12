// Following applications rather than rulesets (Trello card 22): init picks the stack except what Pega
// ships, sync finds each application's rulesets and lists another application through its alias.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, parse } from '../src/commands/index.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { fakePega } from './fake-pega.mjs';

function setup({ gameboard = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  const pega = fakePega();
  if (gameboard) {
    // Gameboard as a built-on application of Test, the operator opening it with its alias.
    const stack = pega.stack.bind(pega);
    pega.stack = async () => {
      const s = await stack();
      s.layers[0].builtOn.unshift({ application: 'Gameboard', version: '01.01.01' });
      s.layers.splice(1, 0, { application: 'Gameboard', version: '01.01.01', rulesets: ['Gameboard:01-01', 'Cvent:01-01'], builtOn: [], organization: 'AutreOrg', classification: 'Standard' });
      return s;
    };
  }
  const pc = (line) => launch(parse(line.split(' ').filter(Boolean)), { root, connect: async () => pega });
  return { root, pega, pc, m: mirror(root) };
}

test('init: the applications of the stack except those Pega ships; --all takes them too', async () => {
  const { pc, m } = setup();
  const r = await pc('init');
  assert.equal(r.output, 'mirror created in .pega/, followed applications: Test (shipped by Pega, not followed: Constellation, PegaRULES; --all follows them). Next: pega-ctx sync');
  assert.deepEqual(m.readConfig().applications, ['Test']);
  assert.deepEqual(m.readConfig().rulesets, []);
  assert.match(m.readStack(), /\n2\. Constellation 01\.01 \(not mirrored\): Constellation:01-01\n3\. PegaRULES 8 \(not mirrored\): /);
  assert.equal((await pc('init --force --all')).code, 0);
  assert.deepEqual(m.readConfig().applications, ['Test', 'Constellation', 'PegaRULES']);
});

test('sync: the rulesets of the followed applications, found in the stack; nothing listed through an alias for the current one', async () => {
  const { pega, pc, m } = setup();
  await pc('init');
  assert.equal((await pc('sync')).code, 0);
  const rulesets = new Set(m.readIndex().flatMap((r) => r.rulesets.map((x) => x.split(':')[0])));
  assert.deepEqual([...rulesets], ['Test']);
  assert.equal(pega.calls.some((c) => c[0] === 'alias'), false);
});

test('sync: another followed application is listed and read in its context, then the context is closed', async () => {
  const { pega, pc, m } = setup({ gameboard: true });
  assert.match((await pc('init')).output, /followed applications: Test, Gameboard \(/);
  const r = await pc('sync');
  assert.equal(r.code, 0, r.output);
  const index = m.readIndex();
  assert.equal(index.find((l) => l.name === 'IgnoredRegistrationType').application, 'Gameboard');
  assert.ok(index.some((l) => l.application === 'Test'));
  // Listing: Test first, then Gameboard under its alias; each Gameboard rule read under the alias too.
  const aliases = pega.calls.filter((c) => c[0] === 'alias').map((c) => c[1]);
  assert.deepEqual(aliases.slice(0, 2), ['gameboard', null]);
  assert.equal(aliases.at(-1), null);
  const readGameboard = pega.calls.findIndex((c) => c[0] === 'read' && /IGNOREDREGISTRATIONTYPE/.test(c[1]));
  assert.equal(pega.calls.slice(0, readGameboard).filter((c) => c[0] === 'alias').at(-1)[1], 'gameboard');
  assert.match(m.readStack(), /\n2\. Gameboard 01\.01\.01: Gameboard:01-01, Cvent:01-01\n3\. Constellation 01\.01 \(not mirrored\)/);
});

test('sync: a followed application the operator cannot open is reported, the others are synchronized', async () => {
  const { pc, m } = setup();
  await pc('init --all');
  const r = await pc('sync');
  assert.equal(r.code, 0);
  assert.match(r.output, /\n- Constellation: not mirrored, the operator cannot open it \(no alias in list-available-applications\)\n- PegaRULES: not mirrored/);
  assert.ok(m.readIndex().length > 0);
});

test('sync: an application outside the stack is reported, its rulesets being unknown', async () => {
  const { pc, m } = setup();
  await pc('init');
  m.writeConfig({ ...m.readConfig(), applications: ['Test', 'Elsewhere'] });
  const r = await pc('sync');
  assert.match(r.output, /\n- Elsewhere: not in the stack of Test, its rulesets are unknown: /);
});
