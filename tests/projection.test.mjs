// Projection: for each raw rule of the fixture, the expected digest from tests/fixture/digest/,
// the extracted references, and no dropped field. UPDATE_DIGESTS=1 npm test rewrites the expected
// digests: read them again before committing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { project, MAX_LINES, PROJECTIONS } from '../src/projection/index.mjs';
import { TYPES } from '../src/mcp/tools.mjs';
import { decodeToon } from '../src/mcp/toon.mjs';
import { probableReferences } from '../src/projection/generic.mjs';
import { raws, rowOf, index, read, DIGEST } from './fixture-helpers.mjs';

const digests = Object.fromEntries(raws.map((r) => [r.id, project(read(r), { line: rowOf(r), index })]));
// Families dropped on principle (docs/projection.md): keys, operators, warnings, generated code, key timestamps.
const DROPPED = /(?<![.\w])(pzInsKey|pzOriginalInstanceKey|pzChecksum|pzIndex\w*|pzRuleSetVersion\w*|pxWarning\w*|pxCreate(?:DateTime|Operator|OpName|SystemID)|pxUpdate\w*|pyJava\w*|pyXMLSignature|pyTaskStatusXml|pySourceStream)\b|#\d{8}T\d{6}/;
const to = (id, confidence = 'sure') => digests[id].references.filter((r) => r.confidence === confidence).map((r) => r.to);

for (const r of raws) {
  test(`${r.id}: expected digest`, () => {
    const file = join(DIGEST, r.type, r.folder, `${r.name}.md`);
    const d = digests[r.id];
    if (process.env.UPDATE_DIGESTS) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, d.markdown);
    }
    assert.ok(existsSync(file), `expected digest missing: UPDATE_DIGESTS=1 npm test, then read ${file}`);
    assert.equal(d.markdown, readFileSync(file, 'utf8'));
  });

  test(`${r.id}: six-line header, a hundred lines at most, no dropped field`, () => {
    const { markdown, id } = digests[r.id];
    const lines = markdown.trimEnd().split('\n');
    assert.equal(lines[0], `# ${r.type} ${r.name}`);
    assert.deepEqual(lines.slice(1, 6).map((l) => l.split(': ')[0]), ['class', 'rulesets', 'description', 'updated', 'available']);
    assert.ok(lines.length <= MAX_LINES, `${lines.length} lines`);
    assert.ok(lines.includes('## References'));
    assert.equal(id, r.id);
    assert.doesNotMatch(markdown, DROPPED, 'persistence field in the digest');
    assert.doesNotMatch(markdown, /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'GUID in the digest');
  });
}

const W = 'MONORG-Test-Work-GetInfo';
const P = 'MONORG-Test-Data-People';

test('CaseType: the flows of its processes, sure', () => {
  assert.deepEqual(to(`CaseType:${W}:pyDefault`), [`Flow:${W}:GetInfoStart`, `Flow:${W}:CollectHousehold`]);
  assert.match(digests[`CaseType:${W}:pyDefault`].markdown, /1\. Répondant \(initial\)\n {3}- .*: flow GetInfoStart/);
});

test('Flow: flow actions of the assignments, activity of the utility, shapes in graph order', () => {
  const d = digests[`Flow:${W}:CollectHousehold`];
  assert.deepEqual(to(d.id), [`FlowAction:${W}:CollectHouseholdSize`, `FlowAction:${W}:EnterHouseholdMembers`, `Activity:${W}:SaveHouseholdPeople`]);
  const order = [...d.markdown.matchAll(/^\d+\. (\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(order, ['Start1', 'Assignment1', 'Assignment2', 'Utility1', 'End1']);
});

test('FlowAction: its view', () => {
  assert.deepEqual(to(`FlowAction:${W}:CollectHouseholdSize`), [`View:${W}:CollectHouseholdSize`]);
});

test('View: properties, included view in its class, data page as list source', () => {
  assert.deepEqual(to(`View:${W}:CollectHouseholdSize`), [`Property:${W}:HouseholdMemberCount`]);
  assert.deepEqual(to(`View:${W}:pyEdit`), [`View:${P}:RequesterDetails`, `Property:${W}:Requester`]);
  assert.ok(to(`View:${P}:HouseholdMembersPicker`).includes(`DataPage:${P}:D_PeopleList`));
  assert.ok(to(`View:${W}:EnterHouseholdMembers`).includes(`View:${P}:pyPrimaryFields`));
});

test('DataTransform: targets in the class of the iterated page, no standard property', () => {
  const r = to(`DataTransform:${W}:BuildHouseholdReferences`);
  assert.ok(r.includes(`Property:${W}:HouseholdGroupID`));
  assert.ok(r.includes(`Property:${P}:HouseholdID`), 'target of the loop on PeopleForLinks');
  assert.ok(!r.some((id) => /:p[xyz][A-Z]/.test(id)), 'standard property referenced');
});

test('Section: included section and data page of the list', () => {
  const g = 'AutreOrg-Gameboard-Int-Demo-Response';
  assert.deepEqual(to('Section:AutreOrg-Gameboard-Data-Player:IndividualScores'), [`DataPage:${g}:D_GetDemoResults`, `Section:${g}:InData`]);
});

test('When: its decision table, evaluated in the expression, is a sure reference', () => {
  const c = 'OrgEv-Int-CventAtt-Data';
  assert.deepEqual(to(`When:${c}:IsIgnoredRegistrationType`), [`DecisionTable:${c}:IgnoredRegistrationType`]);
});

test('generic detection: a name cited outside a structured field → probable edge, marked ?', () => {
  assert.ok(to(`Flow:${W}:CollectHousehold`, 'probable').includes(`View:${W}:EnterHouseholdMembers`));
  assert.match(digests[`Flow:${W}:CollectHousehold`].markdown, /- View:\S+:EnterHouseholdMembers \? \(name match\)/);
});

test('Activity: applied data transform and saved data page, in the class of the step page', () => {
  const r = to(`Activity:${W}:SaveHouseholdPeople`);
  assert.ok(r.includes(`DataTransform:${W}:BuildHouseholdReferences`));
  assert.ok(r.includes(`DataPage:${P}:D_People`));
});

test('DecisionTable: one row per condition value, the default result even when it is false', () => {
  const md = digests['DecisionTable:OrgEv-Int-CventAtt-Data:IgnoredRegistrationType'].markdown;
  assert.match(md, /\| = Vendor \| true \|\n\| = Client Speaker \| true \|\n\notherwise: false\n/);
});

test('DataPage: the source rule; Validate: checked property and data page of the condition', () => {
  assert.deepEqual(to(`DataPage:${P}:D_PeopleList`), [`ReportDefinition:${P}:DataTableEditorReport`]);
  assert.ok(to('Validate:AutreOrg-Gameboard-Work-Game:ValidateToScene2').includes('DataPage:AutreOrg-Gameboard-Work-Game:D_GetTable'));
});

test('generic detection: parent class only, neither itself nor an edge already sure', () => {
  const o = { pyClassName: 'A-B-C', pyRuleName: 'Me', note: 'Me Parent Child Neighbour Sure' };
  const idx = [
    { id: 'View:A-B-C:Me', type: 'View', class: 'A-B-C', name: 'Me' },
    { id: 'When:A-B:Parent', type: 'When', class: 'A-B', name: 'Parent' },
    { id: 'When:A-B-C-D:Child', type: 'When', class: 'A-B-C-D', name: 'Child' },
    { id: 'When:A-X:Neighbour', type: 'When', class: 'A-X', name: 'Neighbour' },
    { id: 'When:A-B-C:Sure', type: 'When', class: 'A-B-C', name: 'Sure' },
  ];
  const r = probableReferences(o, 'Flow', idx, new Set(['When:A-B-C:Sure']));
  assert.deepEqual(r.map((x) => x.to), ['When:A-B:Parent']);
});

test('each projection is for a known type and has at least one fixture rule', () => {
  for (const type of Object.keys(PROJECTIONS)) {
    assert.ok(TYPES[type], `${type}: projection of an unknown type`);
    assert.ok(raws.some((r) => r.type === type), `${type} without fixture rule: a projection without fixture is not delivered`);
  }
});

test('a rule class outside TYPES still gets a type and a generic digest', () => {
  const d = project({ pxObjClass: 'Rule-Declare-Expressions', pyClassName: 'A-B', pyRuleName: 'Total', pyRuleSet: 'R', pyRuleSetVersion: '01-01-01' });
  assert.equal(d.id, 'Expressions:A-B:Total');
  assert.match(d.markdown, /\nbody: type without projection, see docs\/projection\.md\n/);
});

test('type without projection: header, pointer line, generic references', () => {
  const o = decodeToon(read(raws.find((r) => r.type === 'Activity')));
  const saved = PROJECTIONS.Activity;
  delete PROJECTIONS.Activity;
  try {
    const d = project(o, { index });
    assert.match(d.markdown, /\nbody: type without projection, see docs\/projection\.md\n/);
    assert.ok(d.references.every((r) => r.confidence === 'probable'));
  } finally {
    PROJECTIONS.Activity = saved;
  }
});

test('CaseType without a date in list(): the digest says so', () => {
  assert.match(digests[`CaseType:${W}:pyDefault`].markdown, /\nupdated: unknown date, by dev\.un\n/);
});

test('body and references too long: cut, with the command to see the rest', () => {
  const o = {
    pxObjClass: 'Rule-Obj-Model', pyClassName: 'A-B', pyRuleName: 'Long', pyRuleSet: 'R', pyRuleSetVersion: '01-01-01',
    pyProperties: Array.from({ length: 150 }, (_, i) => ({ pyActionName: 'SET', pyPropertiesName: `.P${i}`, pyPropertiesValue: '"x"', pyPropertyStepId: String(i + 1) })),
  };
  const lines = project(o).markdown.trimEnd().split('\n');
  assert.ok(lines.length <= MAX_LINES);
  assert.ok(lines.some((l) => /^… \d+ more lines: pega-ctx rule DataTransform:A-B:Long --raw$/.test(l)));
  assert.ok(lines.includes('… 120 more: pega-ctx around DataTransform:A-B:Long --depth 1'));
});

test('AITool: the activity it runs; ConnectREST: the property filled by the response', () => {
  assert.deepEqual(to('AITool:MONORG-Test-Work:PegaCtxFxAITool'), ['Activity:MONORG-Test-Work:MyActivity']);
  assert.match(digests['ConnectREST:MONORG-Test-Work:PegaCtxFxConnect'].markdown, /### GET\n- request headers Accept=application\/json\n- response data Response Message→\.pyResponseData/);
});

test('ClassMetadata: its primary fields of the application and its list data page; ServiceMCP: its tools', () => {
  assert.deepEqual(to(`ClassMetadata:${P}:${P}`), [`Property:${P}:Title`, `Property:${P}:Age`, `DataPage:${P}:D_PeopleList`]);
  assert.deepEqual(to(`ClassMetadata:${W}:${W}`), [`Property:${W}:HouseholdMembers`]);
  assert.match(digests['ServiceMCP:MONORG-Test-Work:PegaCtxFxAgentMCP'].markdown, /enabled: no\n[^]*## Tools\n- pxGetCaseTypes \(Activity\)\n[^]*- pxInvokeKnowledgeAgent \(Data page\)/);
});

test('a rule with no class (EditValidate): empty class, its folder is _, the code is kept', () => {
  const d = digests['EditValidate::PegaCtxFxEditValidate'];
  assert.equal(d.class, '');
  assert.match(d.markdown, /```java\nif \(!"true"\.equalsIgnoreCase\(theValue\)\)/);
});
