// Templates from the server's examples (copies in tests/fixture/skills/), and the pz* fields a type's
// schema declares as content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pluginExamples, parseExample } from '../src/mcp/examples.mjs';
import { declaredPz, withoutPersistence } from '../src/projection/persistence.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { fixtureMirror, SKILLS } from './mirror-helpers.mjs';

const W = 'MONORG-Test-Work-GetInfo';
const examples = pluginExamples({ folder: SKILLS });

test('examples: the top-level examples of a type, stub first, with label and description; the JSON and the notes', () => {
  const list = examples.list('When');
  assert.deepEqual(list.map((e) => [e.name, e.label]), [['stub', 'Stub When Rule'], ['single-condition-equals', 'Single Condition Equals']]);
  assert.match(list[0].description, /^Minimal When rule/);
  const stub = examples.read('When');
  assert.equal(stub.content.pyBlockName, 'MyWhenRule');
  assert.match(stub.notes, /^- `pyClassName` on `pyFunctionData` MUST match/);
  assert.throws(() => examples.read('When', 'nothing'), /no example nothing for When: one of stub, single-condition-equals \(pega-ctx examples When\)/);
  assert.throws(() => examples.list('Section'), /no skill for Section/);
  assert.deepEqual(examples.list('Flow'), [], 'no copy of the Flow examples in the fixture');
  assert.throws(() => parseExample('---\nname: x\n---\nno json'), /no JSON block/);
});

test('pega-ctx examples: by type, and the count of every writable type', async () => {
  const { pc } = await fixtureMirror();
  const r = await pc('examples When');
  assert.equal(r.code, 0);
  assert.match(r.output, /^- stub: Stub When Rule — Minimal When rule[^\n]*\n- single-condition-equals: Single Condition Equals[^]*\n\npega-ctx create When <Class> <Name> --from example:stub --draft$/);
  const all = await pc('examples');
  assert.match(all.output, /\nWhen \(Rule-Obj-When\): 2 examples\n/);
  assert.match(all.output, /\nNotification \(Rule-Notification\): 1 example\n/);
  assert.match((await pc('examples Flow')).output, /^no example for Flow in the Pega plugin/);
});

test('create --from example: the class of the example replaced everywhere, the key renamed, notes shown', async () => {
  const { root, pc } = await fixtureMirror();
  const id = `When:${W}:IsAdult`;
  const r = await pc(`create When ${W} IsAdult --from example --draft`);
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /\n\nnotes of the example \(example:stub\):\n- `pyClassName` on `pyFunctionData`/);
  const draft = JSON.parse(readFileSync(mirror(root).draftFile(id), 'utf8'));
  assert.equal(draft['pega-ctx'].from, 'example:stub');
  assert.equal(draft['pega-ctx'].reason, 'pega-ctx create IsAdult from example stub');
  const c = draft.content;
  assert.equal(c.pyBlockName, 'IsAdult');
  assert.equal(c.pyClassName, W);
  assert.equal(c.pyCondition[0].pyFunctionData.pyClassName, W, 'the example class, at any depth');
  assert.equal(c.pyStreamName, undefined, 'a name field absent from the example is not added');
  assert.equal(c.pyLabel, 'IsAdult');

  const eq = await pc(`create When ${W} IsUrgent --from example:single-condition-equals --dry-run --json`);
  assert.equal(JSON.parse(eq.output).payload.content.pyBlockName, 'IsUrgent');
  assert.match((await pc(`create When ${W} IsOld --from example:nothing --dry-run`)).output, /^no example nothing for When/);
  assert.match((await pc(`create Section ${W} Panel --from example --dry-run`)).output, /no skill for Section/);
});

test('declaredPz: pz* fields declared with a type are content, untyped ones and instance keys are not', () => {
  const schema = {
    properties: {
      pzRecipients: { type: 'array', items: { type: 'object', properties: { pzIndexCount: { type: 'string' } } } },
      pzChecksum: {},
      pzInsKey: { type: 'string' },
      pyLabel: { type: 'string' },
    },
    allOf: [{ properties: { pzMessageParameters: { type: 'object' } } }],
    $defs: { col: { properties: { pzDesign: { $ref: '#/$defs/x' } } } },
  };
  const keep = declaredPz(schema);
  assert.deepEqual([...keep.root].sort(), ['pzMessageParameters', 'pzRecipients']);
  assert.deepEqual([...keep.nested].sort(), ['pzDesign', 'pzIndexCount']);
  const o = { pzRecipients: [{ pzIndexCount: '1', pzOld: 'x' }], pzChecksum: '1', pzInsKey: 'K', pyLabel: 'L', pzIndexCount: '9' };
  assert.deepEqual(withoutPersistence(o, true, keep), { pzRecipients: [{ pzIndexCount: '1' }], pyLabel: 'L' });
  assert.deepEqual(withoutPersistence(o), { pyLabel: 'L' }, 'without a schema, every pz* is dropped');
});

test('create Notification from its example: pzRecipients kept when the schema declares it', async () => {
  const schema = { type: 'object', title: 'Rule-Notification', properties: { pzRecipients: { type: 'array' }, pyPurpose: { type: 'string' } } };
  const loader = (type) => (type === 'Notification' ? { schema, file: 'rules-rule-notification/schema/rule-notification.json' } : { missing: 'x' });
  const { pc } = await fixtureMirror({ schemas: loader });
  const r = await pc(`create Notification ${W} CaseReady --from example --dry-run --json`);
  assert.equal(r.code, 0, r.output);
  const { content } = JSON.parse(r.output).payload;
  assert.equal(content.pyPurpose, 'CaseReady');
  assert.equal(content.pyClassName, W, 'Work- of the example replaced by the class');
  assert.equal(content.pzRecipients[0].pyRecipientProperties[0].pyNotificationRecipientType, 'Operator');
  assert.match(JSON.parse(r.output).findings.length === 0 ? 'ok' : JSON.stringify(JSON.parse(r.output).findings), /^ok$/);
});
