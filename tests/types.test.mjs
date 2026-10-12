// Rule types: the table generated from the server's schemas, short names, key fields,
// types outside the table (read-only, or added by the project).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { WRITABLE } from '../src/mcp/types.mjs';
import { TYPES, READ_ONLY, NOT_MIRRORED, writable, mirroredTypes } from '../src/mcp/tools.mjs';
import { keyOf, readSchemas, skillsFolder } from '../src/mcp/schemas.mjs';
import { shortName } from '../src/mcp/names.mjs';
import { keyValues, prepareCreation } from '../src/commands/template.mjs';
import { decodeToon } from '../src/mcp/toon.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { raws, read } from './fixture-helpers.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

test('the specification types keep their name and key; DecisionTable is writable', () => {
  const keys = Object.fromEntries(WRITABLE.map((w) => [w.type, w.key.join(' ')]));
  assert.deepEqual(
    { Flow: keys.Flow, FlowAction: keys.FlowAction, View: keys.View, DataTransform: keys.DataTransform, When: keys.When, Activity: keys.Activity, Property: keys.Property, DataPage: keys.DataPage, Validate: keys.Validate, ReportDefinition: keys.ReportDefinition, CaseType: keys.CaseType, Class: keys.Class, DecisionTable: keys.DecisionTable },
    { Flow: 'pyFlowType', FlowAction: 'pyActionName', View: 'pyRuleName', DataTransform: 'pyModelName', When: 'pyBlockName', Activity: 'pyActivityName', Property: 'pyPropertyName', DataPage: 'pyPageName', Validate: 'pyActivityName', ReportDefinition: 'pyStreamName', CaseType: 'pyRuleName', Class: 'pyClassName', DecisionTable: 'pyPurpose' },
  );
  assert.equal(WRITABLE.length, 37);
  assert.equal(new Set(WRITABLE.map((w) => w.type)).size, 37, 'one short name per class');
  assert.equal(TYPES.Section, 'Rule-HTML-Section');
  assert.equal(writable('Section'), undefined, 'create-rule refuses Rule-HTML-Section');
  for (const cls of READ_ONLY) assert.ok(!WRITABLE.some((w) => w.ruleClass === cls), `${cls} is both read-only and writable`);
});

// The table is generated: it must match the schemas of the installed plugin, when there is one.
const folder = (() => {
  try {
    return skillsFolder();
  } catch {
    return undefined;
  }
})();
test('src/mcp/types.mjs matches the installed plugin\'s schemas (node scripts/types.mjs otherwise)', { skip: !folder && 'Pega plugin not installed' }, () => {
  const fromPlugin = readSchemas(folder).map((s) => ({ ruleClass: s.ruleClass, key: keyOf(s.schema), schema: s.file }));
  assert.deepEqual(fromPlugin, WRITABLE.map((w) => ({ ruleClass: w.ruleClass, key: w.key, schema: w.schema })));
  for (const w of WRITABLE) assert.ok(existsSync(`${folder}/${w.schema}`));
});

test('keyOf: x-pega-deriveFrom on pyRuleName, several fields, otherwise the first required name field', () => {
  assert.deepEqual(keyOf({ properties: { pyRuleName: { 'x-pega-deriveFrom': 'pyBlockName' } } }), ['pyBlockName']);
  assert.deepEqual(keyOf({ properties: { pyRuleName: { 'x-pega-deriveFrom': "pyOwner + ' ' + pyPurpose" } } }), ['pyOwner', 'pyPurpose']);
  assert.deepEqual(keyOf({ properties: { pyRuleSet: { 'x-pega-deriveFrom': 'pyRuleSetName' } } }), ['pyRuleSetName']);
  assert.deepEqual(keyOf({ required: ['pxObjClass', 'pyActivityName'], properties: {} }), ['pyActivityName']);
  assert.deepEqual(keyOf({ required: ['pxObjClass'], properties: {} }), ['pyRuleName']);
});

test('shortName: the specification names, otherwise built from the class', () => {
  assert.equal(shortName('Rule-Obj-Model'), 'DataTransform');
  assert.equal(shortName('Rule-Obj-ServiceLevel'), 'ServiceLevel');
  assert.equal(shortName('Rule-Declare-Expressions'), 'Expressions');
  assert.equal(shortName('Rule-Connect-REST'), 'ConnectREST');
  assert.equal(shortName('Rule-Obj-Corr'), 'Correspondence');
});

test('keyValues: several key fields come from the name, separated by its first space', () => {
  assert.deepEqual(keyValues('FieldValue', 'pyStatusWork Pending Review'), { pyFieldName: 'pyStatusWork', pyFieldValue: 'Pending Review' });
  assert.deepEqual(keyValues('When', 'IsAdult'), { pyBlockName: 'IsAdult' });
  assert.throws(() => keyValues('FieldValue', 'pyStatusWork'), /named "pyFieldName pyFieldValue"/);
});

test('create DecisionTable: the key pyPurpose takes the new name', () => {
  const dt = raws.find((r) => r.type === 'DecisionTable');
  const c = prepareCreation(decodeToon(read(dt)), { type: 'DecisionTable', class: dt.class, name: 'IgnoredCountry' });
  assert.equal(c.pyPurpose, 'IgnoredCountry');
  assert.equal(c.pyRuleName, 'IgnoredCountry');
  assert.equal(c.pxObjClass, 'Rule-Declare-DecisionTable');
});

test('sync lists every known type except rulesets and branches, plus the project\'s "types"', async () => {
  assert.ok(mirroredTypes().includes('Notification'));
  assert.ok(mirroredTypes().includes('Section'));
  for (const cls of NOT_MIRRORED) assert.ok(!mirroredTypes().some((t) => TYPES[t] === cls), cls);

  const { root, pega, pc } = await fixtureMirror();
  const m = mirror(root);
  m.writeConfig({ ...m.readConfig(), types: ['Rule-Declare-Expressions'] });
  pega.calls.length = 0;
  const r = await pc('sync');
  assert.equal(r.code, 0, r.output);
  const listed = pega.calls.filter((c) => c[0] === 'list').map((c) => c[1]);
  assert.ok(listed.includes('Expressions'));
  assert.ok(!listed.includes('RuleSetVersion'));

  m.writeConfig({ ...m.readConfig(), types: ['Expressions'] });
  assert.match((await pc('sync')).output, /"Expressions" in types is not a Pega rule class/);
});
