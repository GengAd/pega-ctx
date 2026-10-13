// run-case and units, on the fake client. None launches Java.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, launch } from '../src/commands/index.mjs';
import { mirror } from '../src/mirror/files.mjs';
import { caseClass, fieldValues, actionContent } from '../src/commands/run-case.mjs';
import { fixtureMirror } from './mirror-helpers.mjs';
import { fakePega } from './fake-pega.mjs';

// Without a mirror: the class is given as is.
async function bare(line, options) {
  const pega = fakePega(options);
  const root = mkdtempSync(join(tmpdir(), 'pega-ctx-'));
  const r = await launch(parse(line.split(' ')), { root, connect: async () => pega });
  return { ...r, pega };
}

test('run-case: the case, its first assignment, its flow actions and fields', async () => {
  const r = await bare('run-case MONORG-Test-Work-GetInfo');
  assert.equal(r.code, 0);
  assert.deepEqual(r.output.split('\n'), [
    'case MONORG-TEST-WORK G-71001, stage Requester, status New',
    'assignment CollectRequester — ASSIGN-WORKLIST MONORG-TEST-WORK G-71001!GETINFOSTART',
    '  actions: CollectRequester',
    '  .FirstName  First name  TextInput',
    '  .LastName  Last name  TextInput',
    '  .Age  Age  Integer',
  ]);
  assert.deepEqual(r.pega.calls.map((c) => c[0]), ['createCase']);
});

test('run-case --fields: fills the first assignment, submits its flow action, shows the next one', async () => {
  const r = await bare('run-case MONORG-Test-Work-GetInfo --fields FirstName=Ada,Age=36');
  assert.equal(r.code, 0);
  const [, request] = r.pega.calls.find((c) => c[0] === 'performAction');
  assert.deepEqual(request, {
    assignment: 'ASSIGN-WORKLIST MONORG-TEST-WORK G-71001!GETINFOSTART',
    action: 'CollectRequester',
    content: { Requester: { FirstName: 'Ada', Age: 36 } },
  });
  assert.match(r.output, /\n\nsubmitted CollectRequester: Requester\.FirstName=Ada, Requester\.Age=36\nassignment CollectHouseholdSize — .*!COLLECTHOUSEHOLD\n {2}actions: CollectHouseholdSize\n {2}\.HouseholdMemberCount {2}Other people in the household {2}Integer {2}required$/);
});

test('run-case: Pega refusals as Pega words them, on one line, non-zero code', async () => {
  const created = await bare('run-case MONORG-Test-Work-Nope', { failures: ['create-case'] });
  assert.equal(created.code, 1);
  assert.equal(created.output, 'Pega refused create-case on MONORG-Test-Work-Nope: Error creating case: 400 Bad Request: "{\\"errorDetails\\":[{\\"message\\":\\"Error_Invalid_Inputs_caseTypeID\\"}]}"');

  const submitted = await bare('run-case MONORG-Test-Work-GetInfo --fields Nope=1', { failures: ['perform-action'] });
  assert.equal(submitted.code, 1);
  assert.equal(submitted.output.split('\n').at(-1), 'Pega refused CollectRequester: Error performing action: 400 Bad Request: "{\\"errorDetails\\":[{\\"message\\":\\"Error_Invalid_Inputs_content\\"}]}"');
});

test('run-case: without an assignment in the answer, the case\'s first open assignment', async () => {
  const r = await bare('run-case MONORG-Test-Work-GetInfo', { failures: ['no-next-assignment'] });
  assert.equal(r.code, 0);
  assert.deepEqual(r.pega.calls.map((c) => c[0]), ['createCase', 'caseAssignment', 'assignment']);
  assert.match(r.output, /^case MONORG-TEST-WORK G-71001\nassignment CollectRequester/);
});

test('run-case: a case type name is looked up in the mirror', async () => {
  const { root, pega } = await fixtureMirror();
  const caseType = mirror(root).readIndex().find((r) => r.type === 'CaseType');
  const r = await launch(parse(['run-case', caseType.name]), { root, connect: async () => pega });
  assert.equal(r.code, 0, r.output);
  assert.deepEqual(pega.calls.at(-1), ['createCase', caseType.class]);
  assert.throws(() => caseClass([], 'Nothing'), /unknown case type: Nothing\. Give its class/);
  assert.throws(() => caseClass([caseType, { ...caseType, class: 'X-Other' }], caseType.name), /several case types/);
});

test('fieldValues: dotted path as given, a bare name goes to the only embedded page holding it', () => {
  const content = { status: 'New', Requester: { FirstName: '' }, Other: { Age: '' }, Third: { Age: '' } };
  assert.deepEqual(fieldValues('FirstName=Ada,status=Open,Age=3,Page.X=a=b', content), [
    { path: ['Requester', 'FirstName'], value: 'Ada' },
    { path: ['status'], value: 'Open' },
    { path: ['Age'], value: '3' },
    { path: ['Page', 'X'], value: 'a=b' },
  ]);
  const fields = [{ name: '.Age', type: 'Integer' }, { name: '.Zip', type: 'TextInput' }, { name: '.Ok', type: 'Checkbox' }];
  assert.deepEqual(actionContent(fieldValues('Age=36,Zip=01234,Ok=true'), fields), { Age: 36, Zip: '01234', Ok: true });
});

test('units: summary line, failures first, non-zero code when a test fails', async () => {
  const r = await bare('units --branch TESTS1');
  assert.equal(r.code, 1);
  assert.deepEqual(r.output.split('\n'), [
    'units TESTS1: 2 tests, 1 passed, 1 failed, 0 other',
    'FAIL  Household size (Rule-Obj-Flow, 0.4 s)',
    'PASS  Age is required (Rule-Obj-Validate, 0.12 s)',
  ]);
});

test('units: no test, refused branch, missing branch', async () => {
  const empty = await bare('units --branch TYPES1');
  assert.deepEqual([empty.code, empty.output], [0, 'units TYPES1: no PegaUnit test in this branch']);
  const refused = await bare('units --branch NOPE', { failures: ['run-pegaunits'] });
  assert.equal(refused.code, 1);
  assert.match(refused.output, /^Pega refused run-pegaunits on NOPE: .*No matching branch/);
  const missing = await bare('units');
  assert.equal(missing.code, 1);
  assert.match(missing.output, /^--branch <ID> required/);
  assert.equal(missing.pega.calls.length, 0);
});
