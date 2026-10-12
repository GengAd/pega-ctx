// Commands, on the fixture. None launches Java.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, launch } from '../src/commands/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mirror } from '../src/mirror/files.mjs';
import { LIMIT } from '../src/commands/around.mjs';
import { RAW, raws } from './fixture-helpers.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';
import { fakePega } from './fake-pega.mjs';

test('parse: positionals, --key value, --key=value, flags', () => {
  assert.deepEqual(parse(['around', 'Flow:A:B', '--depth', '2', '--json', '--types=Flow,View']), {
    command: 'around',
    positionals: ['Flow:A:B'],
    options: { depth: '2', json: true, types: 'Flow,View' },
  });
});

test('unknown command: non-zero code, one line that says what to do', async () => {
  const r = await launch(parse(['thing']));
  assert.equal(r.code, 1);
  assert.equal(r.output.split('\n').length, 1);
  assert.match(r.output, /choose among .*measure/);
});

test('measure: one line per type and a total, raw / digest ratio', async () => {
  const r = await launch(parse(['measure', '--raw', RAW]));
  assert.equal(r.code, 0);
  const types = new Set(raws.map((x) => x.type));
  const lines = r.output.split('\n');
  assert.equal(lines.length, 2 + types.size + 1);
  for (const t of types) assert.ok(lines.some((l) => l.startsWith(`| ${t} |`)), t);
  assert.match(lines.at(-1), new RegExp(`^\\| total \\| ${raws.length} \\| \\d+ \\| \\d+ \\| ×[\\d.]+ \\|$`));
});

test('measure --json: the same content for a script', async () => {
  const r = await launch(parse(['measure', '--raw', RAW, '--json']));
  const m = JSON.parse(r.output);
  const total = m.at(-1);
  assert.equal(total.type, 'total');
  assert.equal(total.rules, raws.length);
  assert.ok(total.ratio > 1);
});

test('measure without a mirror: says to run sync', async () => {
  const r = await launch(parse(['measure', '--raw', '/nowhere']));
  assert.equal(r.code, 1);
  assert.match(r.output, /pega-ctx sync/);
});

// --- Mirror built from the fixture (init + sync on the fake client) ---

const W = 'MONORG-Test-Work-GetInfo';

test('init: config, stack.md, already present refused without --force, .gitignore on request', async () => {
  const { root, pc } = await fixtureMirror();
  const config = mirror(root).readConfig();
  assert.deepEqual(config.rulesets, ['Test', 'Gameboard', 'Cvent']);
  assert.deepEqual(config.write, { byClass: [], default: null });
  assert.match(mirror(root).readStack(), /application: Test 01\.01\.01 \(Constellation\)\n/);
  const again = await pc('init');
  assert.equal(again.code, 1);
  assert.match(again.output, /pega-ctx sync/);
  assert.equal((await pc('init --force --ruleset Test --ignore-raw')).code, 0);
  assert.match(readFileSync(join(root, '.gitignore'), 'utf8'), /^\.pega\/raw\/$/m);
});

test('full sync on an empty mirror, then sync without change: nothing read again', async () => {
  const { root, pega, pc, sync } = await fixtureMirror();
  assert.match(sync.output, new RegExp(`^${raws.length} added, 0 changed, 0 removed, 0 types without projection\n`));
  assert.equal(mirror(root).readIndex().length, raws.length);
  pega.calls.length = 0;
  const again = await pc('sync');
  assert.equal(again.output, '0 added, 0 changed, 0 removed, 0 types without projection');
  // CaseType and Class have no date in list(): read every time, without being counted as changed.
  assert.deepEqual(pega.calls.filter((c) => c[0] === 'read').length, 2);
});

test('sync: rule changed in Pega read again, vanished rule removed from the mirror', async () => {
  const { root, pega, pc } = await fixtureMirror();
  const flow = pega.rows.find((r) => r.name === 'GetInfoStart');
  flow.updated = '2026-10-11T09:00:00.000Z';
  pega.raws.set(flow.key, pega.raws.get(flow.key).replace('pyLabel: Créer GetInfo et saisir le répondant', 'pyLabel: Démarrer GetInfo'));
  pega.rows.splice(pega.rows.findIndex((r) => r.name === 'DataTableEditorReport'), 1);
  const r = await pc('sync');
  assert.match(r.output, /^0 added, 1 changed, 1 removed/);
  assert.match(r.output, new RegExp(`\n~ Flow:${W}:GetInfoStart\n- ReportDefinition:`));
  const m = mirror(root);
  assert.match(m.readDigest(`Flow:${W}:GetInfoStart`), /\ndescription: Démarrer GetInfo\n/);
  assert.equal(m.readIndex().find((l) => l.name === 'GetInfoStart').updated, '2026-10-11T09:00:00.000Z');
  assert.ok(!m.readIndex().some((l) => l.type === 'ReportDefinition'));
  assert.equal(m.readRaw('ReportDefinition:MONORG-Test-Data-People:DataTableEditorReport'), undefined);
  assert.equal(m.readDigest('ReportDefinition:MONORG-Test-Data-People:DataTableEditorReport'), undefined);
});

test('sync: a rule with no class (list() gives none) is kept by the next sync, not removed and re-added', async () => {
  const { root, pega, pc } = await fixtureMirror();
  const key = 'RULE-EDIT-VALIDATE CHECKCOUNT #20261008T144933.915 GMT';
  pega.rows.push({ key, type: 'EditValidate', name: 'CheckCount', ruleset: 'Test', version: '01-01-01', updated: '2026-10-08T14:49:33.915Z', by: 'dev.un' });
  pega.raws.set(key, 'pxObjClass: Rule-Edit-Validate\npyClassName: ""\npyRuleName: CheckCount\npyRuleSet: Test\npyRuleSetVersion: "01-01-01"\npzInsKey: RULE-EDIT-VALIDATE CHECKCOUNT #20261008T144933.915 GMT\n');
  assert.match((await pc('sync')).output, /^1 added, 0 changed, 0 removed[^]*\n\+ EditValidate::CheckCount/);
  const m = mirror(root);
  assert.ok(m.readRaw('EditValidate::CheckCount'));
  const again = await pc('sync');
  assert.match(again.output, /^0 added, 0 changed, 0 removed/);
  assert.ok(!again.output.includes('errors:'));
});

test('sync: a failing list() does not stop the others, its rules stay, the error is listed', async () => {
  const { root } = await fixtureMirror();
  const r = await launch(parse(['sync']), { root, connect: async () => fakePega({ failures: ['Validate'] }) });
  assert.equal(r.code, 0);
  assert.match(r.output, /0 removed/);
  assert.match(r.output, /\nerrors:\n- list Validate: 500/);
  assert.ok(mirror(root).readIndex().some((l) => l.type === 'Validate'));
});

test('sync without a mirror: says to run init', async () => {
  const r = await launch(parse(['sync']), { root: '/nowhere', connect: async () => { throw new Error('not called'); } });
  assert.equal(r.code, 1);
  assert.match(r.output, /pega-ctx init/);
});

test('search: every word, case-insensitive, --type, line id — description — rulesets', async () => {
  const { pc } = await fixtureMirror();
  const r = await pc('search FOYER composition');
  assert.deepEqual(r.output.split('\n'), [
    `FlowAction:${W}:CollectHouseholdSize — Composition du foyer — Test:01-01-01`,
    `View:${W}:CollectHouseholdSize — Composition du foyer — Test:01-01-01`,
  ]);
  assert.deepEqual((await pc('search foyer --type View')).output.split('\n').map((l) => l.split(' — ')[0].split(':')[0]), ['View', 'View']);
  assert.match((await pc('search nowhere')).output, /^no rule for "nowhere"/);
});

test('rule: digest by identifier or by bare name, --raw, --cited-by, ambiguous name', async () => {
  const { pc } = await fixtureMirror();
  const r = await pc(`rule Flow:${W}:CollectHousehold`);
  assert.match(r.output, /^# Flow CollectHousehold\n/);
  assert.match(r.output, /\n## Cited by\n- CaseType:\S+:pyDefault \(process\)$/);
  assert.equal((await pc('rule GetInfoStart')).code, 0);
  assert.match((await pc('rule GetInfoStart --raw')).output, /^pxObjClass: Rule-Obj-Flow\n/);
  const tree = await pc('rule FlowAction:MONORG-Test-Work-GetInfo:CollectHouseholdSize --cited-by');
  assert.match(tree.output, /## Cited by, two levels\n- Flow:\S+:CollectHousehold \(assignment\)\n {2}- CaseType:\S+:pyDefault \(process\)/);
  const ambiguous = await pc('rule CollectHouseholdSize');
  assert.equal(ambiguous.code, 1);
  assert.match(ambiguous.output, /^several rules named CollectHouseholdSize: give the identifier among /);
  assert.match((await pc('rule Unknown')).output, /pega-ctx search Unknown/);
});

test('around: from the closest to the farthest, --types filters the output, --stage starts from the stage', async () => {
  const { pc } = await fixtureMirror();
  const titles = (s) => [...s.matchAll(/^# (\w+ \w+)$/gm)].map((x) => x[1]);
  const r = await pc('around pyDefault --depth 2');
  assert.deepEqual(titles(r.output).slice(0, 3), ['CaseType pyDefault', 'Flow GetInfoStart', 'Flow CollectHousehold']);
  assert.ok(r.output.includes('\n\n---\n\n'));
  const f = await pc('around pyDefault --depth 3 --types FlowAction');
  assert.deepEqual(titles(f.output), ['CaseType pyDefault', 'FlowAction CollectHouseholdSize']);
  const s = await pc('around pyDefault --stage Foyer --depth 1');
  assert.deepEqual(titles(s.output), ['CaseType pyDefault', 'Flow CollectHousehold']);
  assert.match((await pc('around pyDefault --stage Missing')).output, /choose among Répondant, Foyer/);
  assert.match((await pc(`around Flow:${W}:GetInfoStart --stage Foyer`)).output, /only applies to a CaseType/);
});

test(`around: beyond ${LIMIT} rules, stops and says how to narrow`, async () => {
  const { root, pc } = await fixtureMirror();
  const m = mirror(root);
  const index = m.readIndex();
  const leaves = Array.from({ length: LIMIT + 5 }, (_, i) => ({ id: `When:X:W${i}`, type: 'When', class: 'X', name: `W${i}`, refs: [] }));
  m.writeIndex([...index, { id: 'Flow:X:Root', type: 'Flow', class: 'X', name: 'Root', refs: [] }, ...leaves]);
  m.writeGraph({ edges: leaves.map((l) => ({ from: 'Flow:X:Root', to: l.id, via: 'test', confidence: 'sure' })) });
  const r = await pc('around Flow:X:Root --depth 1');
  assert.equal(r.code, 1);
  assert.equal(r.output, `${LIMIT + 6} rules: reduce the depth, filter with --types, or target a --stage`);
});

test('stack: stack.md with the rulesets seen, --for adds the inheritance and where to write', async () => {
  const { root, pc } = await fixtureMirror();
  const stack = (await pc('stack')).output;
  assert.match(stack, /^# Stack\n/);
  assert.match(stack, /\n## Rulesets seen in the mirror\n- Test:01-01-01, Test: 26 rules, classes MONORG-Test-Data-People, MONORG-Test-Work, MONORG-Test-Work-GetInfo\n/);
  assert.match(stack, /\n- Cvent:01-01-05, a built-on application \(the server does not say which\): 2 rules, classes OrgEv-Int-CventAtt-Data\n/);
  // A class with rules in the mirror: its siblings say where to write.
  assert.match((await pc(`stack --for ${W}`)).output, new RegExp(`\nwrite to: Test:01-01-01 \\(sibling rules of ${W}\\)$`));
  // A new class without a table: unknown, ask.
  const sub = 'MONORG-Test-Work-GetInfo-Sub';
  const r = await pc(`stack --for ${sub}`);
  assert.match(r.output, new RegExp(`## Inheritance of ${sub}\\n.*\\n- ${W}\\n`));
  assert.match(r.output, /\nwrite to: unknown, .*ask the user/);
  const m = mirror(root);
  m.writeConfig({ ...m.readConfig(), write: { byClass: [{ prefix: 'MONORG-Test-', ruleset: 'Test:01-01-02' }], default: null } });
  assert.match((await pc(`stack --for ${sub}`)).output, /\nwrite to: Test:01-01-02 \(write table, prefix MONORG-Test-\)$/);
});

test('check: missing references, orphans, old sync; non-zero code', async () => {
  const { root, pc } = await fixtureMirror();
  const r = await pc('check');
  assert.equal(r.code, 1);
  const lines = r.output.split('\n');
  assert.ok(lines.includes(`Flow:${W}:GetInfoStart cites FlowAction:${W}:CollectRequester, missing from the mirror: pega-ctx sync, or the rule comes from an application that is not followed`));
  assert.ok(lines.some((l) => /^View:MONORG-Test-Data-People:HouseholdMembersPicker is cited by no rule/.test(l)));
  assert.ok(!lines.some((l) => l.includes('without projection')), 'every type has its projection');
  assert.ok(!lines.some((l) => /^(last sync|never synchronized)/.test(l)));
  const m = mirror(root);
  m.writeConfig({ ...m.readConfig(), lastSync: '2026-01-01T00:00:00.000Z' });
  assert.match((await pc('check')).output, /\nlast sync \d+ days ago: pega-ctx sync$/);
  assert.ok(Array.isArray(JSON.parse((await pc('check --json')).output)));
});

test('measure: reads .pega/raw of the mirror by default', async () => {
  const { pc } = await fixtureMirror();
  const r = await pc('measure');
  assert.equal(r.code, 0);
  assert.match(r.output, new RegExp(`\\| total \\| ${raws.length} \\|`));
});

test('--json: the read commands return JSON', async () => {
  const { pc } = await fixtureMirror();
  for (const line of ['search foyer --json', 'rule GetInfoStart --json', 'around GetInfoStart --json', 'stack --json', 'sync --json']) {
    const r = await pc(line);
    assert.doesNotThrow(() => JSON.parse(r.output), line);
  }
});

test('install: instructions written with the mirror values, block replaced on the second run, existing content kept', async () => {
  const { root, pc } = await fixtureMirror();
  writeFileSync(join(root, 'CLAUDE.md'), '# Project\n\nHouse rule.\n');
  const r = await pc('install');
  assert.equal(r.code, 0);
  assert.match(r.output, /^instructions written to CLAUDE\.md, \.github\/copilot-instructions\.md; to complete by hand: \[What the mirror does not say/);
  const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
  assert.match(claude, /^# Project\n\nHouse rule\.\n\n<!-- pega-ctx:start -->\n# Test\n\nPega application 01\.01\.01\./);
  assert.match(claude, /The write ruleset depends on the class: `pega-ctx stack --for <Class>` says it\./);
  assert.match(claude, /ask the user which one before writing/);
  assert.ok(!claude.includes('[Name:Version]'));
  await pc('install --claude');
  const again = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
  assert.equal(again, claude, 'running again replaces the block, without doubling it');
  assert.equal(readFileSync(join(root, '.github', 'copilot-instructions.md'), 'utf8').split('<!-- pega-ctx:start -->').length, 2);
});
