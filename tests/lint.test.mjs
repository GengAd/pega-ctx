// Lint: the JSON Schema validator, the line of each finding, the lint of create / update / send drafts,
// the schemas written for the editor, and the server's real schemas on the fixture (if the plugin is there).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { validate, fitTypes } from '../src/lint/jsonschema.mjs';
import { lineOf } from '../src/lint/positions.mjs';
import { lint, findingsText } from '../src/lint/lint.mjs';
import { pluginSchemas } from '../src/mcp/schemas.mjs';
import { writable, TYPES } from '../src/mcp/tools.mjs';
import { prepareCreation } from '../src/commands/template.mjs';
import { decodeToon } from '../src/mcp/toon.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { declaredPz } from '../src/projection/persistence.mjs';
import { raws, read } from './fixture-helpers.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';

const W = 'MONORG-Test-Work-GetInfo';
const FA = `FlowAction:${W}:CollectHouseholdSize`;
const messages = (v, s) => validate(v, s).map((e) => `${e.pointer}: ${e.message}`);

test('validate: type, const, enum, pattern, lengths, required (unless filled by the server), unknown field', () => {
  const s = {
    type: 'object',
    required: ['pyName', 'pyKind', 'pyAuto'],
    additionalProperties: false,
    properties: {
      pxObjClass: { const: 'Rule-X' },
      pyName: { type: 'string', pattern: '^[A-Z]', maxLength: 5 },
      pyKind: { type: 'string', enum: ['A', 'B'] },
      pyCount: { type: 'integer' },
      pyAuto: { type: 'string', 'x-pega-autoFill': 'Yes' },
    },
  };
  assert.deepEqual(messages({ pxObjClass: 'Rule-X', pyName: 'Ab', pyKind: 'A' }, s), []);
  assert.deepEqual(messages({ pxObjClass: 'Rule-Y', pyName: 'abcdefg', pyKind: 'C', pyCount: '3', label: 1 }, s), [
    '/pxObjClass: must be "Rule-X", not "Rule-Y"',
    '/pyName: "abcdefg" does not match ^[A-Z]',
    '/pyName: at most 5 characters, found 7',
    '/pyKind: "C" is not allowed: one of "A", "B"',
    '/pyCount: expected integer, found string "3"',
    '/label: unknown field label for this schema: remove it',
  ]);
  assert.deepEqual(messages({}, s), [': missing field pyName: add it', ': missing field pyKind: add it']);
});

test('validate: $ref, items, allOf, if/then, not, x-pega-condition, anyOf / oneOf, contains, dependentRequired', () => {
  const s = {
    $defs: { step: { type: 'object', required: ['pyMethod'], properties: { pyMethod: { type: 'string' } } } },
    type: 'object',
    dependentRequired: { pyAsk: ['pyMessage'] },
    properties: {
      pySteps: { type: 'array', items: { $ref: '#/$defs/step' }, contains: { properties: { pyMethod: { const: 'End' } }, required: ['pyMethod'], 'x-pega-condition': 'the last step must be End' } },
      pyMode: { anyOf: [{ type: 'integer' }, { type: 'string', enum: ['auto'] }] },
      pyOne: { oneOf: [{ type: 'string' }, { type: 'string', minLength: 1 }] },
    },
    allOf: [
      { if: { properties: { pyAsk: { const: 'false' } }, required: ['pyAsk'] }, then: { 'x-pega-condition': 'pyMessage only when pyAsk is true', not: { required: ['pyMessage'] } } },
      { not: { required: ['pyLegacy'] } },
    ],
  };
  assert.deepEqual(messages({ pySteps: [{ pyMethod: 'Set' }, { pyMethod: 'End' }], pyMode: 3 }, s), []);
  const got = messages({ pySteps: [{}, { pyMethod: 'Set' }], pyMode: 'manual', pyOne: 'x', pyAsk: 'false', pyMessage: 'Sure?', pyLegacy: 1 }, s);
  for (const m of [
    ': pyMessage only when pyAsk is true',
    ': pyLegacy not allowed here: remove it',
    '/pySteps/0: missing field pyMethod: add it',
    '/pySteps: the last step must be End',
    '/pyMode: "manual" is not allowed: one of "auto"',
    '/pyOne: matches 2 of the allowed shapes, exactly one expected',
  ]) assert.ok(got.includes(m), `${m}\n in ${got.join('\n')}`);
  assert.equal(got.length, 6);
  assert.deepEqual(messages({ pyAsk: 'true' }, s), [': pyAsk needs pyMessage: add it']);
});

test('fitTypes: "10" → 10 and "true" → true where the schema says so, through $ref, allOf and items', () => {
  const s = {
    $defs: { stage: { type: 'object', properties: { pyIsInit: { type: 'boolean' } } } },
    type: 'object',
    allOf: [{ properties: { pyUrgency: { type: 'integer' } } }],
    properties: { pyStages: { type: 'array', items: { $ref: '#/$defs/stage' } }, pyLabel: { type: 'string' }, pyAny: { type: ['string', 'integer'] } },
  };
  assert.deepEqual(fitTypes({ pyUrgency: '10', pyStages: [{ pyIsInit: 'true' }, { pyIsInit: 'maybe' }], pyLabel: '12', pyAny: '5', pyOther: '1' }, s), {
    pyUrgency: 10, pyStages: [{ pyIsInit: true }, { pyIsInit: 'maybe' }], pyLabel: '12', pyAny: '5', pyOther: '1',
  });
});

test('lineOf: the line of each value; a missing field points at its object', () => {
  const text = JSON.stringify({ a: 1, content: { pyLabel: 'x', pySteps: [{ pyMethod: 'Set' }, { pyMethod: 'End' }] } }, null, 2);
  const at = lineOf(text);
  assert.equal(at('/content/pyLabel'), 4);
  assert.equal(at('/content/pySteps/1/pyMethod'), 10);
  assert.equal(at('/content/pySteps/1/pyMissing'), 9);
  assert.equal(at('/nothing'), 1);
});

test('lint: fields managed by Pega, derived fields, update errors outside the patch as warnings, no schema', () => {
  const schema = { type: 'object', required: ['pyLabel'], properties: { pyLabel: { type: 'string' }, pyRuleName: { type: 'string', 'x-pega-autoDerived': true, 'x-pega-deriveFrom': 'pyBlockName' }, pyBlockName: { type: 'string' }, pyLogic: { type: 'string', enum: ['A', 'A AND B'] } } };
  const created = lint({ operation: 'create', ruleClass: 'Rule-Obj-When', content: { pyLabel: 'x', pyBlockName: 'IsAdult', pyRuleName: 'Old', pyCondition: [{ pzIndex: '1' }], pyRuleSetVersion: '01' }, schema });
  assert.deepEqual(created.map((f) => `${f.level} ${f.pointer}: ${f.message}`), [
    'error /pyCondition/0/pzIndex: pzIndex is managed by Pega: remove it',
    'error /pyRuleSetVersion: pyRuleSetVersion is managed by Pega: remove it',
    'warning /pyRuleName: the server derives pyRuleName from pyBlockName: "Old" will become "IsAdult"',
  ]);
  const updated = lint({ operation: 'update', ruleClass: 'Rule-Obj-When', content: { pyLogic: 'A OR B' }, base: { pyBlockName: 'IsAdult', pzInsKey: 'K' }, schema });
  assert.deepEqual(updated.map((f) => `${f.level} ${f.pointer}: ${f.message}`), [
    'warning : missing field pyLabel: add it (already so in Pega, outside the patch)',
    'error /pyLogic: "A OR B" is not allowed: one of "A", "A AND B"',
  ]);
  assert.match(lint({ operation: 'create', content: {}, missing: 'Pega plugin not found' })[0].message, /^not checked against a schema \(Pega plugin not found\)/);
  assert.equal(findingsText([]), 'lint: no problem');
  assert.equal(findingsText(updated, { lineOf: () => 7, prefix: '/content' }), 'lint: 1 error, 1 warning\nerror line 7  /content/pyLogic: "A OR B" is not allowed: one of "A", "A AND B"\nwarning line 7  /content: missing field pyLabel: add it (already so in Pega, outside the patch)');
});

// A FlowAction schema shaped like the server's, for the commands.
const FA_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'rule-obj-flowaction.json',
  title: 'Rule-Obj-FlowAction',
  type: 'object',
  required: ['pxObjClass', 'pyActionName', 'pyLabel', 'pyClassName'],
  properties: {
    pxObjClass: { type: 'string', const: 'Rule-Obj-FlowAction' },
    pyActionName: { type: 'string' },
    pyLabel: { type: 'string', maxLength: 30 },
    pyClassName: { type: 'string' },
    pyRuleAvailable: { type: 'string', enum: ['Yes', 'No'] },
    pyMeta: { type: 'string', description: 'A JSON-stringified object.' },
  },
};
const loader = (type) => (type === 'FlowAction' ? { schema: FA_SCHEMA, file: 'rules-rule-obj-flowaction/schema/rule-obj-flowaction.json' } : { missing: `no schema for ${type}` });

test('create --draft: "$schema" for the editor, copies in .pega/schemas/; lint shows the line; send refuses an error unless --no-lint', async () => {
  const { root, pc, pega } = await fixtureMirror({ schemas: loader });
  const m = mirror(root);
  const id = `FlowAction:${W}:Confirm`;
  const r = await pc(`create FlowAction ${W} Confirm --from ${FA} --draft`);
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /\n\nlint: no problem$/);
  const file = m.draftFile(id);
  const draft = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(draft.$schema, '../../../schemas/draft-rule-obj-flowaction.json');
  const wrapper = JSON.parse(readFileSync(resolve(dirname(file), draft.$schema), 'utf8'));
  assert.deepEqual(wrapper.properties.content, { $ref: 'rule-obj-flowaction.json' });
  const copy = JSON.parse(readFileSync(join(m.paths.base, 'schemas', 'rule-obj-flowaction.json'), 'utf8'));
  assert.equal(copy.$id, undefined, 'no $id: the copy is resolved from its own file');
  assert.deepEqual(copy.properties.pyMeta.type, ['string', 'object', 'array'], 'a JSON string may be unfolded in the draft');
  assert.deepEqual(copy.required, FA_SCHEMA.required);

  // Corrected by hand, wrongly: the label is too long, availability unknown.
  draft.content.pyLabel = 'A label far too long for this schema';
  draft.content.pyRuleAvailable = 'Maybe';
  writeFileSync(file, JSON.stringify(draft, null, 2));
  const at = lineOf(readFileSync(file, 'utf8'));
  const l = await pc(`lint ${id}`);
  assert.equal(l.code, 1);
  assert.match(l.output, new RegExp(`^\\.pega/drafts/FlowAction/${W}/Confirm\\.json\\nlint: 2 errors\\n`));
  assert.ok(l.output.includes(`error line ${at('/content/pyLabel')}  /content/pyLabel: at most 30 characters, found 36`), l.output);
  assert.ok(l.output.includes(`error line ${at('/content/pyRuleAvailable')}  /content/pyRuleAvailable: "Maybe" is not allowed: one of "Yes", "No"`));

  pega.calls.length = 0;
  const s = await pc(`send ${id} --branch US42`);
  assert.equal(s.code, 1);
  assert.match(s.output, /lint: 2 errors\n[^]*\nnothing sent: fix the content, or --no-lint to let the server decide$/);
  assert.ok(!pega.calls.some((c) => c[0] === 'create'));
  const forced = await pc(`send ${id} --branch US42 --no-lint`);
  assert.equal(forced.code, 0, forced.output);
  assert.equal(pega.calls.find((c) => c[0] === 'create')[1].content.pyRuleAvailable, 'Maybe');
});

test('update --draft: copy without top-level required fields; create without draft refused on a lint error', async () => {
  const { root, pc, pega } = await fixtureMirror({ schemas: loader });
  const m = mirror(root);
  const p = join(root, 'p.json');
  writeFileSync(p, JSON.stringify({ pyRuleAvailable: 'Maybe' }));
  const r = await pc(`update ${FA} --patch ${p} --draft`);
  assert.match(r.output, /\nlint: 1 error\nerror line \d+ {2}\/content\/pyRuleAvailable: "Maybe" is not allowed/);
  assert.equal(JSON.parse(readFileSync(m.draftFile(FA), 'utf8')).$schema, '../../../schemas/draft-update-rule-obj-flowaction.json');
  assert.equal(JSON.parse(readFileSync(join(m.paths.base, 'schemas', 'update-rule-obj-flowaction.json'), 'utf8')).required, undefined);
  assert.match((await pc(`update ${FA} --patch ${p} --branch US42`)).output, /nothing sent: fix the content/);
  assert.ok(!pega.calls.some((c) => c[0] === 'update'));

  const label = join(root, 'l.json');
  writeFileSync(label, JSON.stringify({ pyRuleAvailable: 'Unknown' }));
  const c = await pc(`create FlowAction ${W} Confirm --from ${FA} --patch ${label} --branch US42`);
  assert.equal(c.code, 1);
  assert.match(c.output, /^lint: 1 error\nerror {2}\/pyRuleAvailable: "Unknown" is not allowed/);
});

// The server's real schemas, from the installed plugin: what pega-ctx prepares from each fixture rule
// passes, except where the real rule itself holds what the schema refuses (docs/mcp-tools.md).
const real = pluginSchemas();
const plugin = Boolean(real('When').schema);
test('real schemas: each fixture template, prepared by create and its types fitted, passes the server\'s schema', { skip: !plugin && 'Pega plugin not installed' }, () => {
  const known = {
    DataPage: ['/pyDataSourceList/0: ReportDefinition source requires pyLoadReportDefinition, pyReportDefinitionClass, and pyPassCurrentParamPageForActivity'],
    ReportDefinition: ['/pyContent/ValidationMap', '/pyContent/pySource/pyReportDBType', '/pyUI/pyReportingDbDropdown'],
    ConnectGenerativeAI: ['/pyGenAIConfig/pyModelConfiguration/pyModelParameters/0: missing field pyName', '/pyGenAIConfig/pyModelConfiguration/pyModelParameters/0: missing field pyType', '/pyGenAIConfig/pyModelConfiguration/pyModelParameters/0: missing field pyValue'],
  };
  for (const r of raws.filter((x) => writable(x.type))) {
    const { schema } = real(r.type);
    const name = r.type === 'CaseType' ? 'pyDefault' : writable(r.type).key[0] === 'pyClassName' ? r.class : `${r.name}Copy`;
    const content = fitTypes(prepareCreation(decodeToon(read(r)), { type: r.type, class: r.class, name, keep: declaredPz(schema) }), schema);
    const errors = validate({ pxObjClass: TYPES[r.type], ...content }, schema).map((e) => `${e.pointer}: ${e.message}`);
    const expected = known[r.type] ?? [];
    assert.equal(errors.length, expected.length, `${r.id}\n${errors.join('\n')}`);
    for (const e of expected) assert.ok(errors.some((x) => x.startsWith(e)), `${r.id}: ${e}`);
  }
});

// The server's own stubs, prepared by create --from example, against the server's schemas. Four do not
// pass: they are inconsistencies of the Pega MCP, written in docs/mcp-tools.md; a plugin update that
// changes this list must be looked at.
test('real schemas: the server\'s stubs, prepared by create --from example, pass except the known ones', { skip: !plugin && 'Pega plugin not installed' }, async () => {
  const { pluginExamples } = await import('../src/mcp/examples.mjs');
  const { WRITABLE } = await import('../src/mcp/types.mjs');
  const examples = pluginExamples();
  const cls = 'MyOrg-App-Work-Probe';
  const failing = [];
  for (const w of WRITABLE) {
    if (!examples.list(w.type).some((e) => e.name === 'stub')) continue;
    const name = w.type === 'CaseType' ? 'pyDefault' : w.key[0] === 'pyClassName' ? cls : w.key.length > 1 ? 'First Second' : 'Probe';
    const { schema } = real(w.type);
    const content = fitTypes(prepareCreation(examples.read(w.type).content, { type: w.type, class: cls, name, keep: declaredPz(schema) }), schema);
    if (validate(content, schema).length) failing.push(w.type);
  }
  assert.deepEqual(failing.sort(), ['AITool', 'ConnectGenerativeAI', 'TestUnitCase', 'UITheme']);
});
