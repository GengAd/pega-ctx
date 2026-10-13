// live, create, update on a fixture mirror. --dry-run first; the writes go to the fake client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeToon } from '../src/mcp/toon.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { withoutPersistence } from '../src/projection/persistence.mjs';
import { merge, prepareCreation } from '../src/commands/template.mjs';
import { readRenames } from '../src/commands/create.mjs';
import { raws, read } from './fixture-helpers.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const W = 'MONORG-Test-Work-GetInfo';
const FA = `FlowAction:${W}:CollectHouseholdSize`;
const rawOf = (id) => decodeToon(read(raws.find((r) => r.id === id)));
const patch = (root, name, content) => {
  const f = join(root, name);
  writeFileSync(f, JSON.stringify(content));
  return f;
};
const noPersistence = (o, path = '') => {
  if (Array.isArray(o)) return o.forEach((x, i) => noPersistence(x, `${path}[${i}]`));
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    assert.ok(!k.startsWith('pz') && !['pxUpdateOperator', 'pxWarnings', 'pxCreateOperator', 'pxCreateDateTime'].includes(k), `${path}.${k}`);
    noPersistence(v, `${path}.${k}`);
  }
};

test('withoutPersistence: no more pz*, operator or warning, at any depth; nested pxObjClass kept', () => {
  const o = withoutPersistence(rawOf(`Flow:${W}:CollectHousehold`));
  noPersistence(o);
  assert.equal(o.pyModelProcess.pxObjClass, 'Embed-Rule-Obj-Flow-ProcessModel');
  assert.equal(o.pyJavaStream, undefined);
  assert.equal(o.pyRuleSetVersion, undefined, 'the version comes from the branch');
});

test('merge: objects merged, array replaced entirely, null removes', () => {
  assert.deepEqual(merge({ a: { b: 1, c: 2 }, l: [1, 2, 3], x: 1 }, { a: { c: 9 }, l: [7], x: null }), { a: { b: 1, c: 9 }, l: [7] });
});

test('create View --fields: :TextArea makes a Text property multi-line, :required sets both surfaces; wrong options refused', async () => {
  const P = 'MONORG-Test-Data-People';
  const { pc } = await fixtureMirror();
  const r = await pc(`create View ${P} Card --from View:${W}:CollectHouseholdSize --fields Title:TextArea:required,Age:required --dry-run --json`);
  assert.equal(r.code, 0, r.output);
  const { content } = JSON.parse(r.output).payload;
  assert.deepEqual(content.pyContent[0].pyContent.map((c) => [c.pyFieldReference, c.pyComponentName, c.pxObjClass, c.pyRequiredOption]), [
    ['Title', 'TextArea', 'Pega-UI-Content-Field-Text-Paragraph', 'always'],
    ['Age', 'Integer', 'Pega-UI-Content-Field-Integer', 'always'],
  ]);
  const meta = JSON.parse(content.pxViewMetadata);
  assert.deepEqual(meta.children[0].children.map((c) => [c.type, c.config.required]), [['TextArea', true], ['Integer', true]]);
  assert.match(JSON.parse(r.output).digest, /\.Title: TextArea, required\n {2}- \.Age: Integer, required/);
  const plain = JSON.parse((await pc(`create View ${P} Card --from View:${W}:CollectHouseholdSize --fields Title --dry-run --json`)).output).payload.content;
  assert.equal(plain.pyContent[0].pyContent[0].pyRequiredOption, undefined);
  assert.equal(JSON.parse(plain.pxViewMetadata).children[0].children[0].config.required, undefined);
  assert.match((await pc(`create View ${P} Card --from View:${W}:CollectHouseholdSize --fields Title:Big --dry-run`)).output, /^--fields: Title:Big: unknown option Big; after a property, :TextArea and :required/);
  assert.match((await pc(`create View ${P} Card --from View:${W}:CollectHouseholdSize --fields Age:TextArea --dry-run`)).output, /^--fields: Age is of type Integer: only a Text property can be a TextArea/);
});

test('prepareCreation: key of the type, name fields renamed, not the referenced view', () => {
  const c = prepareCreation(rawOf(FA), { type: 'FlowAction', class: W, name: 'Confirm', patch: {} });
  assert.equal(c.pyActionName, 'Confirm');
  assert.equal(c.pyRuleName, 'Confirm');
  assert.equal(c.pyStreamName, 'Confirm');
  assert.equal(c.pyLabel, 'Confirm');
  assert.equal(c.pyViewReference, 'CollectHouseholdSize', 'same name as the old FlowAction, but another rule');
  assert.equal(c.pxObjClass, 'Rule-Obj-FlowAction');
});

test('prepareCreation: a view also renames its metadata; a type without schema renamed by its name fields; CaseType always pyDefault', () => {
  const v = prepareCreation(rawOf(`View:${W}:CollectHouseholdSize`), { type: 'View', class: W, name: 'Confirmation', patch: {} });
  assert.equal(JSON.parse(v.pxViewMetadata).name, 'Confirmation');
  const s = prepareCreation(rawOf('Section:AutreOrg-Gameboard-Data-Player:IndividualScores'), { type: 'Section', class: 'AutreOrg-Gameboard-Data-Team', name: 'TeamScores', patch: {} });
  assert.deepEqual([s.pxObjClass, s.pyClassName, s.pyRuleName, s.pyStreamName], ['Rule-HTML-Section', 'AutreOrg-Gameboard-Data-Team', 'TeamScores', 'TeamScores']);
  assert.throws(() => prepareCreation(rawOf(`CaseType:${W}:pyDefault`), { type: 'CaseType', class: 'A-Work-B', name: 'Other' }), /always named pyDefault/);
});

test('create Class: new class from a sibling class, same parent and same group; the name is the class', async () => {
  const N = 'MONORG-Test-Work-Attestation';
  const c = prepareCreation(rawOf(`Class:${W}:${W}`), { type: 'Class', class: N, name: N, label: 'Attestation', patch: {} });
  assert.equal(c.pyClassName, N);
  assert.equal(c.pyRuleName, N);
  assert.equal(c.pyDerivesFrom, 'MONORG-Test-Work');
  assert.equal(c.pyClassGroup, 'MONORG-Test-Work');
  assert.equal(c.pyLabel, 'Attestation');
  assert.throws(() => prepareCreation(rawOf(`Class:${W}:${W}`), { type: 'Class', class: N, name: 'Attestation' }), /a Class carries its class as name/);

  // A new class has no sibling rule: without a "write" table, create refuses and asks.
  const { root, pc } = await fixtureMirror();
  const refused = await pc(`create Class ${N} ${N} --from ${W} --label Attestation --dry-run`);
  assert.equal(refused.code, 1);
  assert.match(refused.output, new RegExp(`^no write ruleset known for ${N} \\(rulesets seen: Test:01-01-01, Cvent:01-01-05, Gameboard:01-01-17\\): ask the user`));
  const m = mirror(root);
  m.writeConfig({ ...m.readConfig(), write: { byClass: [{ prefix: 'MONORG-Test-', ruleset: 'Test:01-01-01' }], default: null } });
  const r = await pc(`create Class ${N} ${N} --from ${W} --label Attestation --dry-run --json`);
  assert.equal(r.code, 0, r.output);
  const { payload, write, digest } = JSON.parse(r.output);
  assert.equal(payload.ruleset, 'Test');
  assert.equal(write.source, 'write table, prefix MONORG-Test-');
  assert.match(digest, new RegExp(`# Class ${N}\\n[^]*derives from: MONORG-Test-Work\\n`));
});

test('create: --ruleset first, then the "write" table, then the sibling rules; several rulesets in a class → refused', async () => {
  const { root, pc } = await fixtureMirror();
  const m = mirror(root);
  const ruleset = async (line) => JSON.parse((await pc(`${line} --dry-run --json`)).output).payload.ruleset;
  const base = `create FlowAction ${W} Confirm --from ${FA}`;
  assert.equal(await ruleset(base), 'Test', 'sibling rules of the class');
  m.writeConfig({ ...m.readConfig(), write: { byClass: [{ prefix: 'MONORG-Test-Work-', ruleset: 'TestWork:01-01-01' }], default: null } });
  assert.equal(await ruleset(base), 'TestWork', 'the table wins over the siblings');
  assert.equal(await ruleset(`${base} --ruleset Other:01-01-01`), 'Other', '--ruleset wins over everything');

  // A class whose rules sit in two rulesets: ambiguous, no guess.
  m.writeConfig({ ...m.readConfig(), write: { byClass: [], default: null } });
  const index = m.readIndex();
  m.writeIndex([...index, { ...index.find((l) => l.id === FA), id: `When:${W}:IsOther`, type: 'When', name: 'IsOther', rulesets: ['TestExt:01-01-01'], refs: [] }]);
  const r = await pc(`${base} --dry-run`);
  assert.equal(r.code, 1);
  assert.match(r.output, new RegExp(`^several rulesets hold rules of ${W}: Test:01-01-01 \\(\\d+ rules\\), TestExt:01-01-01 \\(1 rules\\)\\. Ask the user`));
});

test('create --rename: a flow action cited everywhere in the flow changes name at once; view as an object accepted', async () => {
  const f = prepareCreation(rawOf(`Flow:${W}:GetInfoStart`), { type: 'Flow', class: W, name: 'RequestStart', patch: {}, rename: [['CollectRequester', 'EnterRequest']] });
  assert.ok(!JSON.stringify(f).includes('"CollectRequester"'));
  assert.equal(f.pyLocalActions[0].pyActionName, 'EnterRequest');
  assert.throws(() => readRenames('A=B,C'), /is not Old=New/);

  const { root, pc } = await fixtureMirror();
  const meta = { name: 'X', type: 'View', config: { template: 'DefaultForm' }, children: [{ name: 'Fields', type: 'Region', children: [{ type: 'TextInput', config: { value: '@P .LastName', label: '@FL .LastName' } }] }] };
  const p = patch(root, 'v.json', { pxViewMetadata: meta });
  const r = await pc(`create View ${W} RequestEntry --from View:${W}:CollectHouseholdSize --patch ${p} --dry-run --json`);
  assert.equal(r.code, 0, r.output);
  assert.equal(typeof JSON.parse(r.output).payload.content.pxViewMetadata, 'string');
  assert.match(JSON.parse(r.output).digest, /\.LastName: TextInput/);
});

test('create View --fields: the three surfaces built from the mirror properties; missing property refused', async () => {
  const P = 'MONORG-Test-Data-People';
  const { pc } = await fixtureMirror();
  const r = await pc(`create View ${P} Card --from View:${W}:CollectHouseholdSize --fields Title,.Age --dry-run --json`);
  assert.equal(r.code, 0, r.output);
  const { content } = JSON.parse(r.output).payload;
  assert.deepEqual(content.pyContent[0].pyContent.map((c) => [c.pyFieldReference, c.pyComponentName, c.pxObjClass, c.pyPromptClass]), [
    ['Title', 'TextInput', 'Pega-UI-Content-Field-Text', P],
    ['Age', 'Integer', 'Pega-UI-Content-Field-Integer', P],
  ]);
  const meta = JSON.parse(content.pxViewMetadata);
  assert.deepEqual(meta.children[0].children.map((c) => c.config.value), ['@P .Title', '@P .Age']);
  assert.equal(meta.config.localeReference, `@LR ${P.toUpperCase()}!VIEW!CARD`);
  assert.deepEqual(JSON.parse(content.pxContextMetadata).$properties, ['.Title', '.Age']);
  assert.match(JSON.parse(r.output).digest, /\.Title: TextInput\n {2}- \.Age: Integer/);

  assert.match((await pc(`create View ${P} Card --from View:${W}:CollectHouseholdSize --fields Unknown --dry-run`)).output, /property Unknown missing[^]*create Property/);
  assert.match((await pc(`create View ${W} Card --from View:${W}:CollectHouseholdSize --fields HouseholdMembers --dry-run`)).output, /type PageList/);
});

test('create: the template class is replaced at any depth, the description comes from the label', () => {
  const N = 'MONORG-Test-Work-Attestation';
  const c = prepareCreation(rawOf(`CaseType:${W}:pyDefault`), { type: 'CaseType', class: N, name: 'pyDefault', label: 'Attestation' });
  assert.ok(!JSON.stringify(c).includes(`"${W}"`));
  assert.equal(c.pyDescription, 'Attestation');
});

test('create --dry-run: digest of the planned rule, nothing sent to Pega', async () => {
  const { root, pc, pega } = await fixtureMirror();
  const f = patch(root, 'p.json', { pyViewReference: 'Confirmation' });
  pega.calls.length = 0;
  const r = await pc(`create FlowAction ${W} Confirm --from ${FA} --patch ${f} --label Confirm-the-entry --dry-run`);
  assert.equal(r.code, 0, r.output);
  // The label is English where the application's labels are French: a convention line, not a refusal.
  assert.match(r.output, new RegExp(`^dry-run: nothing is written to Pega\\nruleset: Test:01-01-01 \\(sibling rules of ${W}\\)\\nconvention: the label "Confirm-the-entry" reads English, the labels of MONORG-Test- are in French\\n\\n# FlowAction Confirm\\n`));
  assert.match(r.output, /\ndescription: Confirm-the-entry\n/);
  assert.match(r.output, /\nview: Confirmation\n/);
  assert.deepEqual(pega.calls, []);
});

test('create --dry-run --json: the content sent, without persistence, patch array replacing', async () => {
  const { root, pc } = await fixtureMirror();
  const f = patch(root, 'dt.json', { pyProperties: [{ pxObjClass: 'Embed-ModelParams', pyActionName: 'SET', pyPropertiesName: '.Status', pyPropertiesValue: '"New"', pyPropertyStepId: '1' }] });
  const r = await pc(`create DataTransform ${W} Initialize --from BuildHouseholdReferences --patch ${f} --ruleset Test:01-01-01 --dry-run --json`);
  const { payload, digest } = JSON.parse(r.output);
  assert.equal(payload.ruleset, 'Test');
  assert.equal(payload.content.pyModelName, 'Initialize');
  assert.equal(payload.content.pyProperties.length, 1);
  noPersistence(payload.content);
  assert.match(digest, /\n- 1 \.Status = "New"\n/);
});

test('create: refused without --from, template of another type, existing rule, patch with persistence, without branch', async () => {
  const { root, pc } = await fixtureMirror();
  assert.match((await pc(`create FlowAction ${W} X`)).output, /--from <id> required/);
  assert.match((await pc(`create FlowAction ${W} X --from GetInfoStart`)).output, /is a Flow, not a FlowAction/);
  assert.match((await pc(`create FlowAction ${W} CollectHouseholdSize --from ${FA}`)).output, /already exists: pega-ctx update/);
  const f = patch(root, 'bad.json', { pzInsKey: 'x' });
  assert.match((await pc(`create FlowAction ${W} X --from ${FA} --patch ${f} --dry-run`)).output, /fields managed by Pega, remove them from the patch: pzInsKey/);
  const g = patch(root, 'bad.json', { description: 'Request' });
  assert.match((await pc(`create FlowAction ${W} X --from ${FA} --patch ${g} --dry-run`)).output, /not Pega fields \(py…, px…\): description/);
  assert.match((await pc(`create FlowAction ${W} X --from ${FA}`)).output, /--branch <ID> required/);
});

test('create with --branch: create-rule gets Pega class, content, branch and reason; then live', async () => {
  const { pc, pega } = await fixtureMirror();
  const r = await pc(`create FlowAction ${W} Confirm --from ${FA} --branch US42 --reason Add-confirmation`);
  const [, request] = pega.calls.find((c) => c[0] === 'create');
  assert.equal(request.type, 'FlowAction');
  assert.equal(request.branch, 'US42');
  assert.equal(request.description, 'Add-confirmation');
  assert.equal(request.content.pyActionName, 'Confirm');
  // The fake client does not apply the write: live does not find it and says so.
  assert.equal(r.code, 0);
  assert.match(r.output, /^created in branch US42, but not readable yet .*: pega-ctx live FlowAction:\S+:Confirm later\nPega warning: Rule write succeeded, but the completed branch summary was not updated\.\n$/);
});

test('live: same as the mirror without header; changed in Pega → first line, raw and digest updated, the others untouched', async () => {
  const { root, pc, pega } = await fixtureMirror();
  const m = mirror(root);
  const r = await pc(`live ${FA}`);
  assert.match(r.output, /^# FlowAction CollectHouseholdSize\n/);
  const other = m.readDigest(`Flow:${W}:CollectHousehold`);
  const row = pega.rows.find((x) => x.type === 'FlowAction');
  pega.raws.set(row.key, pega.raws.get(row.key).replace('pyViewReference: CollectHouseholdSize', 'pyViewReference: OtherView'));
  const d = await pc(`live ${FA}`);
  assert.match(d.output, /^different from the mirror \(synced on \d{4}-\d{2}-\d{2}\)\n\n# FlowAction/);
  assert.match(m.readDigest(FA), /\nview: OtherView\n/);
  assert.match(m.readRaw(FA), /pyViewReference: OtherView/);
  assert.ok(m.readIndex().find((l) => l.id === FA).refs.includes(`View:${W}:OtherView`));
  assert.equal(m.readDigest(`Flow:${W}:CollectHousehold`), other);
  assert.match((await pc(`live Flow:${W}:Missing`)).output, /not found in Pega/);
});

test('update --dry-run: implicit live, digest after the patch, nothing sent; without --dry-run: update-rule with the key', async () => {
  const { root, pc, pega } = await fixtureMirror();
  const f = patch(root, 'm.json', { pyViewReference: 'OtherView' });
  pega.calls.length = 0;
  const d = await pc(`update ${FA} --patch ${f} --dry-run`);
  assert.match(d.output, /^dry-run: nothing is written to Pega\n\n# FlowAction CollectHouseholdSize\n/);
  assert.match(d.output, /\nview: OtherView\n/);
  assert.ok(pega.calls.some((c) => c[0] === 'read'), 'implicit live');
  assert.ok(!pega.calls.some((c) => c[0] === 'update'));
  assert.match(mirror(root).readDigest(FA), /\nview: CollectHouseholdSize\n/, 'the mirror stays the one from Pega');
  assert.match((await pc(`update ${FA} --patch ${f}`)).output, /--branch <ID> required/);
  await pc(`update ${FA} --patch ${f} --branch US42`);
  const [, request] = pega.calls.find((c) => c[0] === 'update');
  assert.equal(request.key, pega.rows.find((x) => x.type === 'FlowAction').key);
  assert.deepEqual(request.patch, { pyViewReference: 'OtherView' });
  assert.equal(request.branch, 'US42');
});
