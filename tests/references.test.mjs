// Semantic lint: what a draft cites, resolved against the mirror (src/lint/references.mjs), on the fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { referenceFindings } from '../src/lint/references.mjs';
import { lineOf } from '../src/lint/positions.mjs';
import { prepareCreation } from '../src/commands/template.mjs';
import { decodeToon } from '../src/mcp/toon.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { raws, read, index } from './fixture-helpers.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const W = 'MONORG-Test-Work-GetInfo';
const P = 'MONORG-Test-Data-People';
const FA = `FlowAction:${W}:CollectHouseholdSize`;
const rawOf = (id) => decodeToon(read(raws.find((r) => r.id === id)));
const readRaw = (id) => {
  const r = raws.find((x) => x.id === id);
  return r ? read(r) : undefined;
};
const lines = (findings) => findings.map((f) => `${f.level} ${f.pointer}: ${f.message}`);

// A flow drafted from the fixture's, its assignment and local action renamed by hand.
const flowCiting = (action) => prepareCreation(rawOf(`Flow:${W}:CollectHousehold`), { type: 'Flow', class: W, name: 'Collect', rename: [['EnterHouseholdMembers', action]] });
// The value at a JSON pointer, JSON strings unfolded as in a draft.
function at(content, pointer) {
  let v = content;
  for (const k of pointer.split('/').slice(1)) {
    if (typeof v === 'string') v = JSON.parse(v);
    v = v[k.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  return v;
}

test('referenceFindings: a flow action the flow cites must exist on the class or a parent; the pointer is a field that cites it', () => {
  const ok = referenceFindings({ operation: 'create', type: 'Flow', content: flowCiting('CollectHouseholdSize'), index, readRaw });
  assert.deepEqual(ok, []);
  const content = flowCiting('Nowhere');
  const bad = referenceFindings({ operation: 'create', type: 'Flow', content, index, readRaw });
  assert.equal(bad.length, 1);
  assert.equal(bad[0].level, 'error');
  assert.equal(at(content, bad[0].pointer), 'Nowhere');
  assert.equal(bad[0].message, `ref: FlowAction Nowhere (assignment) is missing from the mirror on ${W} and its parents: create it first, fix the name, or pega-ctx live FlowAction:${W}:Nowhere if it lives in an application the mirror does not follow`);
});

test('referenceFindings: a Pega name not overridden is a warning; a rule that exists on another class only is a warning; a target not available is a warning', () => {
  // EnterHouseholdMembers includes the view pyPrimaryFields of the People class, which the mirror lacks.
  const view = prepareCreation(rawOf(`View:${W}:EnterHouseholdMembers`), { type: 'View', class: W, name: 'Members' });
  const pega = referenceFindings({ operation: 'create', type: 'View', content: view, index, readRaw });
  assert.equal(pega.length, 1);
  assert.equal(at(view, pega[0].pointer), 'pyPrimaryFields');
  assert.equal(`${pega[0].level}: ${pega[0].message}`, `warning: ref: View pyPrimaryFields (included view) is not in the mirror on ${P} or a parent class: a Pega rule the application does not override, or a typo`);

  // A when of another application's class, cited from the work class.
  const fa = prepareCreation(rawOf(FA), { type: 'FlowAction', class: W, name: 'Confirm', patch: { pyActionWhensList: [{ pyWhenName: 'IsIgnoredRegistrationType' }] } });
  const elsewhere = referenceFindings({ operation: 'create', type: 'FlowAction', content: fa, index, readRaw });
  assert.deepEqual(lines(elsewhere), [`warning /pyActionWhensList/0/pyWhenName: ref: When IsIgnoredRegistrationType (condition) exists on OrgEv-Int-CventAtt-Data only, not a parent of ${W}: Pega will not find it from ${W}; check the class or the name`]);

  const withdrawn = (id) => (id === `View:${W}:CollectHouseholdSize` ? readRaw(id).replace('pyRuleAvailable: Yes', 'pyRuleAvailable: Withdrawn') : readRaw(id));
  const unavailable = referenceFindings({ operation: 'create', type: 'FlowAction', content: prepareCreation(rawOf(FA), { type: 'FlowAction', class: W, name: 'Confirm' }), index, readRaw: withdrawn });
  assert.deepEqual(lines(unavailable), [`warning /pyViewReference: ref: View CollectHouseholdSize (view) is available: withdrawn (View:${W}:CollectHouseholdSize): Pega will not run it`]);
});

test('referenceFindings: a target that is only a draft waiting; an update checks what the patch cites, not the rest of the rule', () => {
  const content = flowCiting('Confirm');
  const pending = referenceFindings({ operation: 'create', type: 'Flow', content, index, drafts: [`FlowAction:${W}:Confirm`, `Flow:${W}:Collect`], readRaw });
  assert.equal(pending.length, 1);
  assert.equal(at(content, pending[0].pointer), 'Confirm');
  assert.equal(`${pending[0].level}: ${pending[0].message}`, `warning: ref: FlowAction Confirm (assignment) is only a draft waiting to be sent: pega-ctx send FlowAction:${W}:Confirm first`);

  // The data transform cites properties the fixture mirror lacks: an update that does not touch them says nothing.
  const base = rawOf(`DataTransform:${W}:BuildHouseholdReferences`);
  assert.deepEqual(referenceFindings({ operation: 'update', type: 'DataTransform', content: { pyLabel: 'Renamed' }, base, index, readRaw }), []);
  const touched = referenceFindings({ operation: 'update', type: 'DataTransform', content: { pyProperties: [{ pyPropertyStepId: '1', pyActionName: 'SET', pyPropertiesName: '.Invented', pyPropertiesValue: '.HouseholdMembers' }] }, base, index, readRaw });
  assert.deepEqual(lines(touched), [`error /pyProperties/0/pyPropertiesName: ref: Property Invented (target) is missing from the mirror on ${W} and its parents: create it first, fix the name, or pega-ctx live Property:${W}:Invented if it lives in an application the mirror does not follow`]);
});

test('referenceFindings: a data page called with parameters it does not declare', () => {
  const base = rawOf(`DataTransform:${W}:BuildHouseholdReferences`);
  const patch = { pyProperties: [{ pyPropertyStepId: '1', pyActionName: 'SET', pyPropertiesName: '.HouseholdMembers', pyPropertiesValue: 'D_PeopleList[HouseholdID: "7", Foo: .pyID].pxResults' }] };
  const found = referenceFindings({ operation: 'update', type: 'DataTransform', content: patch, base, index, readRaw });
  assert.deepEqual(lines(found), ['error /pyProperties/0/pyPropertiesValue: ref: D_PeopleList has no parameter HouseholdID, Foo (declared: none): fix the name, or add it to the data page']);
  // A parameter the data page declares and the call leaves out.
  const declaring = (id) => (id === `DataPage:${P}:D_PeopleList` ? readRaw(id).replace('pyParameters[0]:', 'pyParameters[2]:\n  - pyParametersParamName: HouseholdID\n  - pyParametersParamName: Foo') : readRaw(id));
  const partial = { pyProperties: [{ pyPropertyStepId: '1', pyActionName: 'SET', pyPropertiesName: '.HouseholdMembers', pyPropertiesValue: 'D_PeopleList[HouseholdID: "7"]' }] };
  assert.deepEqual(lines(referenceFindings({ operation: 'update', type: 'DataTransform', content: partial, base, index, readRaw: declaring })), ['warning /pyProperties/0/pyPropertiesValue: ref: D_PeopleList is called without Foo, which it declares: check that the parameter is optional']);
  assert.deepEqual(referenceFindings({ operation: 'update', type: 'DataTransform', content: patch, base, index, readRaw: declaring }), []);
});

test('create, update, lint, send: the ref: lines with their line in the draft; an error stops the write', async () => {
  const { root, pc, pega } = await fixtureMirror();
  const m = mirror(root);
  // A flow drafted with an invented flow action: the error names the line of the draft.
  const id = `Flow:${W}:Collect`;
  const bad = await pc(`create Flow ${W} Collect --from Flow:${W}:CollectHousehold --rename EnterHouseholdMembers=Invented --draft`);
  assert.equal(bad.code, 0, bad.output);
  const text = readFileSync(m.draftFile(id), 'utf8');
  const found = /\nlint: 1 error, 1 warning\nerror line (\d+) {2}(\/content\S+): ref: FlowAction Invented \(assignment\) is missing from the mirror on MONORG-Test-Work-GetInfo and its parents: create it first, fix the name, or pega-ctx live FlowAction:MONORG-Test-Work-GetInfo:Invented if it lives in an application the mirror does not follow\n/.exec(bad.output);
  assert.ok(found, bad.output);
  assert.equal(Number(found[1]), lineOf(text)(found[2]), 'the line of the field in the draft file');
  assert.match(text.split('\n')[Number(found[1]) - 1], /"Invented"/);
  assert.match((await pc(`send ${id} --branch US42`)).output, /ref: FlowAction Invented[^]*\nnothing sent: fix the content/);
  assert.ok(!pega.calls.some((c) => c[0] === 'create'));

  // The flow action drafted too: the flow then waits for it.
  await pc(`create FlowAction ${W} Invented --from ${FA} --draft`);
  const waiting = await pc(`lint ${id}`);
  assert.equal(waiting.code, 0, waiting.output);
  assert.match(waiting.output, new RegExp(`\\nwarning line ${found[1]} {2}${found[2].replaceAll('$', '\\$')}: ref: FlowAction Invented \\(assignment\\) is only a draft waiting to be sent: pega-ctx send FlowAction:${W}:Invented first`));

  // A flow action pointed at a view that does not exist: update refused before the round trip.
  const refused = await pc(`update ${FA} --patch ${patchFile(root, 'u.json', { pyViewReference: 'Nowhere' })} --branch US42`);
  assert.equal(refused.code, 1);
  assert.match(refused.output, new RegExp(`^lint: 1 error, 1 warning\\nerror {2}/pyViewReference: ref: View Nowhere \\(view\\) is missing from the mirror on ${W} and its parents: create it first, fix the name, or pega-ctx live View:${W}:Nowhere if it lives in an application the mirror does not follow\\n`));
  assert.ok(!pega.calls.some((c) => c[0] === 'update'));
});

function patchFile(root, name, content) {
  const file = join(root, name);
  writeFileSync(file, JSON.stringify(content));
  return file;
}
