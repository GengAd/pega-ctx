// MCP layer without Java: TOON decoder and tool table, on responses shaped like the real server's (anonymized).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeToon } from '../src/mcp/toon.mjs';
import { pegaInterface, pluginFolder, commandFromPlugin } from '../src/mcp/client.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TYPES } from '../src/mcp/tools.mjs';
import * as tools from '../src/mcp/tools.mjs';

const APPLICATION = `AppName: Claims
AppVersion: "01.01.01"
RuleSet: Claims
IsConstellationApp: "true"
DependsOn[1]{name,version,mode}:
  Constellation,"01.01",Application
CaseTypes[1]{name,implementationClass,prefix,poolName}:
  Claim,MyOrg-Claims-Work-Claim,C-,MyOrg-Claims-Work

[api: 163 ms | processing: 0 ms]`;

const rule = (name, n) =>
  `  Rule-Obj-Flow,Yes,MYORG-CLAIMS-WORK-CLAIM!${name.toUpperCase()},${name},MyOrg-Claims-Work-Claim,"2026-10-08T14:49:3${n}.000Z",RULE-OBJ-FLOW MYORG-CLAIMS-WORK-CLAIM ${name.toUpperCase()} #2026100${n}T000000.000 GMT,"Flow ${name}, main",dev.one,"01-02-03"`;
const LISTING = (lines) => `fetchDateTime: "2026-10-10T14:17:04.072Z"
pxObjClass: Pega-API-DataExploration-Data
resultCount: ${lines.length}
data[${lines.length}]{pxObjClass,pyRuleAvailable,pxInsName,pyRuleName,pyClassName,pxUpdateDateTime,pzInsKey,pyLabel,pxUpdateOperator,pyRuleSetVersion}:
${lines.join('\n')}

[api: 526 ms | processing: 0 ms]`;

const FLOW = `pxObjClass: Rule-Obj-Flow
pyRuleName: Entry
pyRuleSetVersion: "01-02-03"
pzChecksum: "254301711"
pyXMLSignature: "<?xml version=\\"1.0\\"?><methodSignature></methodSignature>"
pxWarnings[0]:
pyEndingActivities[1]: End1
pyFromTasks[2]:
  - pxObjClass: Embed-Rule-Obj-Flow-FromTasks
    pyFromTaskName: Utility1
    pyToTasks:
      End1:
        pxSubscript: End1
        pyTaskStatusOrWhen: ALWAYS
        pyPropertySet[0]:
  - pxObjClass: Embed-Rule-Obj-Flow-FromTasks
    pyFromTaskName: Assignment1
    pyToTasks:
      Utility1:
        pxSubscript: Utility1
        pyTaskStatus: ValidateEntry
pyUseCaseLinks[1]{pxObjClass,pyLabel,pyTaskID}:
  Link-UseCase,"Entry, step 1",Transition2

[api: 605 ms | processing: 1 ms]`;

test('TOON: objects, inline arrays, lists, tabular arrays, quotes', () => {
  const o = decodeToon(FLOW);
  assert.equal(o.pyRuleName, 'Entry');
  assert.equal(o.pyRuleSetVersion, '01-02-03');
  assert.equal(o.pzChecksum, '254301711');
  assert.equal(o.pyXMLSignature, '<?xml version="1.0"?><methodSignature></methodSignature>');
  assert.deepEqual(o.pxWarnings, []);
  assert.deepEqual(o.pyEndingActivities, ['End1']);
  assert.equal(o.pyFromTasks.length, 2);
  assert.equal(o.pyFromTasks[0].pyToTasks.End1.pyTaskStatusOrWhen, 'ALWAYS');
  assert.deepEqual(o.pyFromTasks[0].pyToTasks.End1.pyPropertySet, []);
  assert.equal(o.pyFromTasks[1].pyFromTaskName, 'Assignment1');
  assert.equal(o.pyFromTasks[1].pyToTasks.Utility1.pyTaskStatus, 'ValidateEntry');
  assert.deepEqual(o.pyUseCaseLinks, [{ pxObjClass: 'Link-UseCase', pyLabel: 'Entry, step 1', pyTaskID: 'Transition2' }]);
});

test('TOON: primitive list item, number, boolean, array too short', () => {
  assert.deepEqual(decodeToon('a[2]:\n  - one (ALWAYS)\n  - 3\nb: true\nc: 01'), { a: ['one (ALWAYS)', 3], b: true, c: '01' });
  assert.throws(() => decodeToon('t[2]{a,b}:\n  1,2'), /announces 2 rows/);
});

function fakeServer(responses) {
  const calls = [];
  const call = async (name, args) => {
    calls.push({ name, args });
    const r = responses[name];
    return typeof r === 'function' ? r(args) : r;
  };
  return { pega: pegaInterface(call), calls };
}

// Application rules as get-rule returns them (2026-10-12), trimmed to the fields the climb reads.
const APP_RULE = (rulesets, dependsOn = []) => [
  'pxObjClass: Rule-Application',
  `pyRuleSetList[${rulesets.length}]: ${rulesets.map((r) => `"${r}"`).join(',')}`,
  `pyDependsOnList[${dependsOn.length}]:`,
  ...dependsOn.flatMap(([name, version]) => ['  - pxObjClass: Embed-DependsOnApp', `    pyAppName: ${name}`, `    pyAppVersion: "${version}"`]),
].join('\n');

test('stack() reads get-application, then climbs the application rules until one cannot be read', async () => {
  const { pega, calls } = fakeServer({
    'get-application': APPLICATION,
    'get-rule': ({ key }) => {
      if (key === 'RULE-APPLICATION CLAIMS 01.01.01') return APP_RULE(['Claims_Branch_B1:01-01-01', 'Claims:01-01', 'MyOrg:01-01'], [['Shared', '02.01'], ['Constellation', '01.01']]);
      if (key === 'RULE-APPLICATION SHARED 02.01') return APP_RULE(['Shared:02-01'], [['Constellation', '01.01']]);
      if (key === 'RULE-APPLICATION CONSTELLATION 01.01') return APP_RULE(['Constellation:01-01'], [['PegaRULES', '8']]);
      throw new Error(`Error fetching rule: 500 Internal Server Error: "{\\"errorDetails\\":[{\\"message\\":\\"pzErrorRuleNotFound\\t${key}\\"}]}"`);
    },
  });
  assert.deepEqual(await pega.stack(), {
    application: 'Claims',
    version: '01.01.01',
    rulesets: ['Claims'],
    builtOn: [{ application: 'Constellation', version: '01.01' }],
    constellation: true,
    layers: [
      { application: 'Claims', version: '01.01.01', rulesets: ['Claims_Branch_B1:01-01-01', 'Claims:01-01', 'MyOrg:01-01'], builtOn: [{ application: 'Shared', version: '02.01' }, { application: 'Constellation', version: '01.01' }] },
      { application: 'Shared', version: '02.01', rulesets: ['Shared:02-01'], builtOn: [{ application: 'Constellation', version: '01.01' }] },
      { application: 'Constellation', version: '01.01', rulesets: ['Constellation:01-01'], builtOn: [{ application: 'PegaRULES', version: '8' }] },
      { application: 'PegaRULES', version: '8', rulesets: [], builtOn: [], error: 'no rule RULE-APPLICATION PEGARULES 8' },
    ],
  });
  // Constellation, built on twice, is read once.
  assert.equal(calls.filter((c) => c.name === 'get-rule').length, 4);
});

test('list() goes through D_pxListRules, returns id, key and update date', async () => {
  const { pega, calls } = fakeServer({ 'run-data-page': LISTING([rule('Entry', 1), rule('Closing', 2)]) });
  const rules = await pega.list({ type: 'Flow', class: 'MyOrg-Claims-Work-Claim' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.dataPage, 'D_pxListRules');
  assert.deepEqual(JSON.parse(calls[0].args.payload).dataViewParameters, {
    ruleTypeClass: 'Rule-Obj-Flow',
    appliesToClass: 'MyOrg-Claims-Work-Claim',
    pageNumber: 1,
    pageSize: 500,
  });
  assert.equal(rules.length, 2);
  assert.equal(rules[0].id, 'Flow:MyOrg-Claims-Work-Claim:Entry');
  assert.equal(rules[0].key, 'RULE-OBJ-FLOW MYORG-CLAIMS-WORK-CLAIM ENTRY #20261001T000000.000 GMT');
  assert.equal(rules[0].updated, '2026-10-08T14:49:31.000Z');
  assert.equal(rules[0].description, 'Flow Entry, main');
  assert.equal(rules[0].version, '01-02-03');
});

test('list() pages as long as the page is full', async () => {
  const full = LISTING(Array.from({ length: 500 }, (_, k) => rule(`R${k}`, 1)));
  const { pega, calls } = fakeServer({
    'run-data-page': (a) => (JSON.parse(a.payload).dataViewParameters.pageNumber === 1 ? full : LISTING([rule('Last', 2)])),
  });
  assert.equal((await pega.list({ type: 'Flow' })).length, 501);
  assert.equal(calls.length, 2);
});

test('list() stops when the server ignores paging and sends the same page again', async () => {
  const full = LISTING(Array.from({ length: 500 }, (_, k) => rule(`R${k}`, 1)));
  const { pega, calls } = fakeServer({ 'run-data-page': () => full });
  assert.equal((await pega.list({ type: 'Flow' })).length, 500);
  assert.equal(calls.length, 2);
});

test('list() refuses an unknown type and names the known types', async () => {
  const { pega } = fakeServer({});
  await assert.rejects(pega.list({ type: 'Screen' }), /unknown type: Screen\. Known types: AIAgent, .*CaseType.*; any other rule class goes in "types" of \.pega\/config\.json$/);
});

test('read() calls get-rule in full detail and returns the TOON without the timing line', async () => {
  const { pega, calls } = fakeServer({ 'get-rule': FLOW });
  const raw = await pega.read('RULE-OBJ-FLOW X ENTRY');
  assert.deepEqual(calls[0].args, { key: 'RULE-OBJ-FLOW X ENTRY', detail: 'full' });
  assert.ok(raw.startsWith('pxObjClass: Rule-Obj-Flow\n'));
  assert.ok(!raw.includes('[api:'));
  assert.ok(raw.endsWith('Transition2\n'));
  assert.deepEqual(decodeToon(raw), decodeToon(FLOW));
});

test('create() and update(): Pega class, JSON as a string, arrays replaced', async () => {
  const { pega, calls } = fakeServer({ 'create-rule': 'status: created', 'update-rule': 'status: updated' });
  await pega.create({ type: 'When', content: { pyRuleName: 'IsAdult' }, branch: 'US42', description: 'Add IsAdult' });
  await pega.update({ key: 'K', patch: { pySteps: [] }, branch: 'US42', description: 'Empty the steps' });
  assert.equal(calls[0].args.ruleType, TYPES.When);
  assert.deepEqual(JSON.parse(calls[0].args.content), { pxObjClass: 'Rule-Obj-When', pyRuleName: 'IsAdult' });
  assert.equal(calls[1].args.listUpdateMode, 'replace');
  assert.equal(calls[1].args.updates, '{"pySteps":[]}');
});

test('create: a field refused by the server schema (string instead of integer) is converted, then sent again once', async () => {
  const sent = [];
  const call = async (name, args) => {
    sent.push(JSON.parse(args.content));
    if (sent.length === 1) {
      const e = new Error('create-rule: Payload validation failed');
      // The server's own wording, French included: both forms are recognized.
      e.text = 'Payload validation failed for Rule-Obj-CaseType:\n\nERRORS (2):\n  - /pyInitialCaseUrgency: string trouvé, integer attendu\n  - /pyStages/0/pyIsInitializationStage: string found, boolean expected\n';
      throw e;
    }
    return 'status: created\n';
  };
  const r = await tools.create(call, { type: 'CaseType', content: { pyInitialCaseUrgency: '10', pyStages: [{ pyIsInitializationStage: 'true' }] }, branch: 'B1', description: 'test' });
  assert.equal(r.status, 'created');
  assert.equal(sent[1].pyInitialCaseUrgency, 10);
  assert.equal(sent[1].pyStages[0].pyIsInitializationStage, true);
  assert.equal(sent[0].pyInitialCaseUrgency, '10', 'the first send is as is');
});

test('PEGA_CTX_PLUGIN: a Copilot plugin folder, ${PLUGIN_ROOT} replaced, missing .mcp.json refused', () => {
  const folder = mkdtempSync(join(tmpdir(), 'pega-plugin-'));
  writeFileSync(join(folder, '.mcp.json'), JSON.stringify({
    mcpServers: { 'pega-infinity-authoring': {
      command: 'java',
      args: ['-jar', '${PLUGIN_ROOT}/resources/infinity-rules-mcp.jar', '--spring.profiles.active=stdio'],
      env: { PEGA_SKILLS_PATH: '${PLUGIN_ROOT}/resources', PEGA_CLIENT_MODE: 'copilot-plugin' },
    } },
  }));
  assert.equal(pluginFolder('/nowhere', folder), folder);
  const { command, args, env } = commandFromPlugin(folder);
  assert.equal(command, 'java');
  assert.equal(args[1], `${folder}/resources/infinity-rules-mcp.jar`);
  assert.deepEqual(env, { PEGA_SKILLS_PATH: `${folder}/resources`, PEGA_CLIENT_MODE: 'copilot-plugin' });
  assert.throws(() => pluginFolder('/nowhere', tmpdir() + '/no-such-plugin'), /no \.mcp\.json in PEGA_CTX_PLUGIN/);
  assert.throws(() => pluginFolder('/nowhere', ''), /set PEGA_CTX_PLUGIN/);
});
